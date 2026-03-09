/**
 * Internal Transfer Matching Routes
 *
 * GET  /transfers/matches  — Detect potential internal transfers
 * POST /transfers/confirm  — Confirm a matched pair as INTERNAL_TRANSFER
 * POST /transfers/dismiss  — Dismiss a matched pair (mark as reviewed)
 */

import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { matchInternalTransfers } from "@dtax/tax-engine";
import type { TransferRecord } from "@dtax/tax-engine";

export async function transferRoutes(app: FastifyInstance) {
  // GET /transfers/matches — Detect potential internal transfer pairs
  app.get("/transfers/matches", async (request, _reply) => {
    // Fetch all TRANSFER_IN and TRANSFER_OUT that haven't been matched yet
    const transfers = await prisma.transaction.findMany({
      where: {
        userId: request.userId,
        type: { in: ["TRANSFER_IN", "TRANSFER_OUT"] },
        NOT: { tags: { has: "transfer_reviewed" } },
      },
      orderBy: { timestamp: "asc" },
    });

    // Convert to engine format
    const records: TransferRecord[] = transfers.map((tx) => ({
      id: tx.id,
      sourceId: tx.sourceId || "unknown",
      type: tx.type as "TRANSFER_IN" | "TRANSFER_OUT",
      timestamp: tx.timestamp,
      asset:
        (tx.type === "TRANSFER_OUT" ? tx.sentAsset : tx.receivedAsset) || "",
      amount:
        Number(
          tx.type === "TRANSFER_OUT" ? tx.sentAmount : tx.receivedAmount,
        ) || 0,
      feeAsset: tx.feeAsset || undefined,
      feeAmount: tx.feeAmount ? Number(tx.feeAmount) : undefined,
    }));

    const result = matchInternalTransfers(records);

    // Enrich matched pairs with source names for the UI
    const enrichedMatches = result.matched.map((m) => ({
      outTx: {
        id: m.outTx.id,
        sourceId: m.outTx.sourceId,
        asset: m.outTx.asset,
        amount: m.outTx.amount,
        timestamp: m.outTx.timestamp.toISOString(),
      },
      inTx: {
        id: m.inTx.id,
        sourceId: m.inTx.sourceId,
        asset: m.inTx.asset,
        amount: m.inTx.amount,
        timestamp: m.inTx.timestamp.toISOString(),
      },
      amountDiff: m.outTx.amount - m.inTx.amount,
      timeDiffMs: m.inTx.timestamp.getTime() - m.outTx.timestamp.getTime(),
    }));

    return {
      data: {
        matches: enrichedMatches,
        unmatchedOut: result.unmatchedOut.length,
        unmatchedIn: result.unmatchedIn.length,
      },
    };
  });

  // POST /transfers/confirm — Confirm a pair as internal transfer
  app.post("/transfers/confirm", async (request, reply) => {
    const body = z
      .object({
        outTxId: z.string().uuid(),
        inTxId: z.string().uuid(),
      })
      .parse(request.body);

    // Verify both transactions exist and belong to user
    const [outTx, inTx] = await Promise.all([
      prisma.transaction.findFirst({
        where: { id: body.outTxId, userId: request.userId },
      }),
      prisma.transaction.findFirst({
        where: { id: body.inTxId, userId: request.userId },
      }),
    ]);

    if (!outTx || !inTx) {
      return reply.status(404).send({
        error: { message: "One or both transactions not found" },
      });
    }

    // Update both to INTERNAL_TRANSFER and link them
    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: body.outTxId },
        data: {
          type: "INTERNAL_TRANSFER",
          originalType: outTx.originalType || outTx.type,
          notes: `Matched with ${body.inTxId}`,
        },
      }),
      prisma.transaction.update({
        where: { id: body.inTxId },
        data: {
          type: "INTERNAL_TRANSFER",
          originalType: inTx.originalType || inTx.type,
          notes: `Matched with ${body.outTxId}`,
        },
      }),
    ]);

    return {
      data: { status: "confirmed", outTxId: body.outTxId, inTxId: body.inTxId },
    };
  });

  // POST /transfers/dismiss — Dismiss a match (keep as separate transfers)
  app.post("/transfers/dismiss", async (request, reply) => {
    const body = z
      .object({
        outTxId: z.string().uuid(),
        inTxId: z.string().uuid(),
      })
      .parse(request.body);

    // Verify both transactions exist and belong to user
    const [outTx, inTx] = await Promise.all([
      prisma.transaction.findFirst({
        where: { id: body.outTxId, userId: request.userId },
      }),
      prisma.transaction.findFirst({
        where: { id: body.inTxId, userId: request.userId },
      }),
    ]);

    if (!outTx || !inTx) {
      return reply.status(404).send({
        error: { message: "One or both transactions not found" },
      });
    }

    // Mark both as reviewed (add tag) so they don't show up in matches again
    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: body.outTxId },
        data: { tags: { push: "transfer_reviewed" } },
      }),
      prisma.transaction.update({
        where: { id: body.inTxId },
        data: { tags: { push: "transfer_reviewed" } },
      }),
    ]);

    return { data: { status: "dismissed" } };
  });
}
