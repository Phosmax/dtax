/**
 * API Route Integration Tests
 *
 * Tests route handlers using Fastify inject() with mocked Prisma.
 * Covers: transactions CRUD, tax calculation, error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildApp, mockTransaction } from "./test-helpers";

// ─── Mock Prisma ────────────────────────────────

const mockPrisma = {
  transaction: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    createMany: vi.fn(),
  },
  taxReport: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
  },
  dataSource: {
    findMany: vi.fn(),
  },
  $queryRaw: vi.fn(),
};

vi.mock("../lib/prisma", () => ({
  prisma: mockPrisma,
}));

// Mock CCXT service for connections route
vi.mock("../services/ccxt", () => ({
  encryptKey: (key: string) => `encrypted_${key}`,
  CcxtService: {
    testConnection: vi.fn().mockResolvedValue(true),
  },
}));

// ─── Tests ──────────────────────────────────────

describe("Health Routes", () => {
  it("GET /api/health returns ok", async () => {
    const app = buildApp();
    const { healthRoutes } = await import("../routes/health");
    await app.register(healthRoutes, { prefix: "/api" });

    const res = await app.inject({ method: "GET", url: "/api/health" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeDefined();

    await app.close();
  });

  it("GET /api/health/deep checks database", async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ 1: 1 }]);

    const app = buildApp();
    const { healthRoutes } = await import("../routes/health");
    await app.register(healthRoutes, { prefix: "/api" });

    const res = await app.inject({ method: "GET", url: "/api/health/deep" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("ok");
    expect(body.services.database).toBe("connected");

    await app.close();
  });

  it("GET /api/health/deep returns degraded when DB fails", async () => {
    mockPrisma.$queryRaw.mockRejectedValueOnce(new Error("Connection refused"));

    const app = buildApp();
    const { healthRoutes } = await import("../routes/health");
    await app.register(healthRoutes, { prefix: "/api" });

    const res = await app.inject({ method: "GET", url: "/api/health/deep" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("degraded");
    expect(body.services.database).toBe("disconnected");

    await app.close();
  });
});

describe("Transaction Routes", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = buildApp();
    const { transactionRoutes } = await import("../routes/transactions");
    await app.register(transactionRoutes, { prefix: "/api/v1" });
  });

  afterEach(async () => {
    await app.close();
  });

  // ─── POST /transactions ─────────────────────

  it("POST /transactions creates a transaction", async () => {
    const created = mockTransaction();
    mockPrisma.transaction.create.mockResolvedValueOnce(created);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/transactions",
      payload: {
        type: "BUY",
        timestamp: "2025-03-01T10:00:00Z",
        receivedAsset: "BTC",
        receivedAmount: 1.5,
        receivedValueUsd: 45000,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.id).toBe("tx-001");
    expect(body.data.receivedAsset).toBe("BTC");
  });

  it("POST /transactions rejects invalid type", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/transactions",
      payload: {
        type: "INVALID_TYPE",
        timestamp: "2025-03-01T10:00:00Z",
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("POST /transactions rejects missing timestamp", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/transactions",
      payload: { type: "BUY" },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toBeDefined();
  });

  // ─── GET /transactions ──────────────────────

  it("GET /transactions returns paginated list", async () => {
    const txs = [mockTransaction(), mockTransaction({ id: "tx-002" })];
    mockPrisma.transaction.findMany.mockResolvedValueOnce(txs);
    mockPrisma.transaction.count.mockResolvedValueOnce(2);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/transactions?page=1&limit=20",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
    expect(body.meta.total).toBe(2);
    expect(body.meta.page).toBe(1);
  });

  it("GET /transactions validates page must be positive", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/transactions?page=0",
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  // ─── GET /transactions/:id ──────────────────

  it("GET /transactions/:id returns transaction", async () => {
    mockPrisma.transaction.findFirst.mockResolvedValueOnce(mockTransaction());

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/transactions/tx-001",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.id).toBe("tx-001");
  });

  it("GET /transactions/:id returns 404 for missing", async () => {
    mockPrisma.transaction.findFirst.mockResolvedValueOnce(null);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/transactions/nonexistent",
    });

    expect(res.statusCode).toBe(404);
  });

  // ─── PUT /transactions/:id ──────────────────

  it("PUT /transactions/:id updates transaction", async () => {
    const existing = mockTransaction();
    const updated = { ...existing, notes: "Updated" };
    mockPrisma.transaction.findFirst.mockResolvedValueOnce(existing);
    mockPrisma.transaction.update.mockResolvedValueOnce(updated);

    const res = await app.inject({
      method: "PUT",
      url: "/api/v1/transactions/tx-001",
      payload: { notes: "Updated" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.notes).toBe("Updated");
  });

  it("PUT /transactions/:id returns 404 for missing", async () => {
    mockPrisma.transaction.findFirst.mockResolvedValueOnce(null);

    const res = await app.inject({
      method: "PUT",
      url: "/api/v1/transactions/nonexistent",
      payload: { notes: "test" },
    });

    expect(res.statusCode).toBe(404);
  });

  // ─── DELETE /transactions/:id ────────────────

  it("DELETE /transactions/:id deletes transaction", async () => {
    mockPrisma.transaction.findFirst.mockResolvedValueOnce(mockTransaction());
    mockPrisma.transaction.delete.mockResolvedValueOnce({});

    const res = await app.inject({
      method: "DELETE",
      url: "/api/v1/transactions/tx-001",
    });

    expect(res.statusCode).toBe(204);
  });

  it("DELETE /transactions/:id returns 404 for missing", async () => {
    mockPrisma.transaction.findFirst.mockResolvedValueOnce(null);

    const res = await app.inject({
      method: "DELETE",
      url: "/api/v1/transactions/nonexistent",
    });

    expect(res.statusCode).toBe(404);
  });

  // ─── GET /transactions/export ────────────────

  it("GET /transactions/export returns CSV", async () => {
    const txs = [mockTransaction()];
    mockPrisma.transaction.findMany.mockResolvedValueOnce(txs);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/transactions/export",
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.body).toContain("Date,Type");
    expect(res.body).toContain("BUY");
  });
});

describe("Tax Routes", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = buildApp();
    const { taxRoutes } = await import("../routes/tax");
    await app.register(taxRoutes, { prefix: "/api/v1" });
  });

  afterEach(async () => {
    await app.close();
  });

  it("POST /tax/calculate computes gains", async () => {
    // 1 BUY lot, 1 SELL event
    const buyTx = mockTransaction({
      id: "buy-1",
      type: "BUY",
      receivedAsset: "BTC",
      receivedAmount: 1,
      receivedValueUsd: 30000,
      timestamp: new Date("2024-01-15T00:00:00Z"),
    });
    const sellTx = mockTransaction({
      id: "sell-1",
      type: "SELL",
      sentAsset: "BTC",
      sentAmount: 1,
      sentValueUsd: 45000,
      feeValueUsd: 10,
      timestamp: new Date("2025-06-15T00:00:00Z"),
    });

    mockPrisma.transaction.findMany
      .mockResolvedValueOnce([buyTx]) // acquisitions (fetchTaxData)
      .mockResolvedValueOnce([sellTx]) // dispositions (fetchTaxData)
      .mockResolvedValueOnce([]); // income items (calculateIncome)

    mockPrisma.taxReport.upsert.mockResolvedValueOnce({
      id: "report-1",
      taxYear: 2025,
      method: "FIFO",
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/tax/calculate",
      payload: { taxYear: 2025, method: "FIFO" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.report.taxYear).toBe(2025);
    expect(body.data.report.method).toBe("FIFO");
    // $45000 - $30000 - $10 fee = $14990 long-term gain
    expect(body.data.report.netGainLoss).toBeCloseTo(14990, 0);
  });

  it("POST /tax/calculate rejects invalid method", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/tax/calculate",
      payload: { taxYear: 2025, method: "INVALID" },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("POST /tax/calculate rejects year before 2009", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/tax/calculate",
      payload: { taxYear: 2008, method: "FIFO" },
    });

    expect(res.statusCode).toBe(400);
  });

  it("GET /tax/summary returns saved report", async () => {
    mockPrisma.taxReport.findUnique.mockResolvedValueOnce({
      taxYear: 2025,
      method: "FIFO",
      shortTermGains: 1000,
      shortTermLosses: 200,
      longTermGains: 5000,
      longTermLosses: 500,
      totalTransactions: 10,
      status: "COMPLETE",
      updatedAt: new Date(),
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/tax/summary?year=2025&method=FIFO",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.taxYear).toBe(2025);
    expect(body.data.netGainLoss).toBe(5300); // (1000-200) + (5000-500)
  });

  it("GET /tax/summary returns 404 when no report", async () => {
    mockPrisma.taxReport.findUnique.mockResolvedValueOnce(null);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/tax/summary?year=2025&method=FIFO",
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("Transfer Routes", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = buildApp();
    const { transferRoutes } = await import("../routes/transfers");
    await app.register(transferRoutes, { prefix: "/api/v1" });
  });

  afterEach(async () => {
    await app.close();
  });

  it("GET /transfers/matches returns empty when no transfers", async () => {
    mockPrisma.transaction.findMany.mockResolvedValueOnce([]);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/transfers/matches",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.matches).toHaveLength(0);
    expect(body.data.unmatchedOut).toBe(0);
    expect(body.data.unmatchedIn).toBe(0);
  });

  it("GET /transfers/matches detects matching pairs", async () => {
    const outTx = mockTransaction({
      id: "out-1",
      type: "TRANSFER_OUT",
      sentAsset: "ETH",
      sentAmount: 10,
      receivedAsset: null,
      sourceId: "binance",
      timestamp: new Date("2025-03-01T10:00:00Z"),
      tags: [],
    });
    const inTx = mockTransaction({
      id: "in-1",
      type: "TRANSFER_IN",
      receivedAsset: "ETH",
      receivedAmount: 9.99,
      sentAsset: null,
      sourceId: "metamask",
      timestamp: new Date("2025-03-01T10:15:00Z"),
      tags: [],
    });

    mockPrisma.transaction.findMany.mockResolvedValueOnce([outTx, inTx]);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/transfers/matches",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.matches).toHaveLength(1);
    expect(body.data.matches[0].outTx.id).toBe("out-1");
    expect(body.data.matches[0].inTx.id).toBe("in-1");
  });
});

describe("Portfolio Routes", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = buildApp();
    const { portfolioRoutes } = await import("../routes/portfolio");
    await app.register(portfolioRoutes, { prefix: "/api/v1" });
  });

  afterEach(async () => {
    await app.close();
  });

  it("GET /portfolio/holdings returns holdings", async () => {
    const buyTx = mockTransaction({
      id: "buy-1",
      type: "BUY",
      receivedAsset: "BTC",
      receivedAmount: 2,
      receivedValueUsd: 60000,
      timestamp: new Date("2024-06-01T00:00:00Z"),
    });

    mockPrisma.transaction.findMany
      .mockResolvedValueOnce([buyTx]) // acquisitions
      .mockResolvedValueOnce([]); // dispositions

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/portfolio/holdings",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.positions).toHaveLength(1);
    expect(body.data.positions[0].asset).toBe("BTC");
    expect(body.data.positions[0].totalAmount).toBe(2);
  });

  it("GET /portfolio/holdings rejects invalid prices JSON", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/portfolio/holdings?prices=not-json",
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.message).toContain("Invalid prices format");
  });
});
