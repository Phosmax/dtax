"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  getTransferMatches,
  confirmTransfer,
  dismissTransfer,
} from "@/lib/api";
import type { TransferMatch, TransferMatchesResult } from "@/lib/api";

function formatTimeDiff(ms: number, t: ReturnType<typeof useTranslations>) {
  const absMs = Math.abs(ms);
  if (absMs < 60 * 60 * 1000) {
    return t("minutes", { count: Math.round(absMs / (60 * 1000)) });
  }
  if (absMs < 24 * 60 * 60 * 1000) {
    return t("hours", { count: Math.round(absMs / (60 * 60 * 1000)) });
  }
  return t("days", { count: Math.round(absMs / (24 * 60 * 60 * 1000)) });
}

function formatAmount(amount: number): string {
  if (amount >= 1)
    return amount.toLocaleString("en-US", { maximumFractionDigits: 6 });
  return amount.toPrecision(6);
}

export default function TransfersPage() {
  const t = useTranslations("transfers");

  const [data, setData] = useState<TransferMatchesResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    key: string;
    message: string;
  } | null>(null);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTransferMatches();
      setData(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  async function handleConfirm(match: TransferMatch) {
    const key = `${match.outTx.id}-${match.inTx.id}`;
    setActionLoading(key);
    try {
      await confirmTransfer(match.outTx.id, match.inTx.id);
      setFeedback({ key, message: t("confirmed") });
      setTimeout(() => {
        setFeedback(null);
        fetchMatches();
      }, 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
    setActionLoading(null);
  }

  async function handleDismiss(match: TransferMatch) {
    const key = `${match.outTx.id}-${match.inTx.id}`;
    setActionLoading(key);
    try {
      await dismissTransfer(match.outTx.id, match.inTx.id);
      setFeedback({ key, message: t("dismissed") });
      setTimeout(() => {
        setFeedback(null);
        fetchMatches();
      }, 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
    setActionLoading(null);
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("title")}</h1>
          <p className="page-subtitle">{t("subtitle")}</p>
        </div>
      </div>

      {loading && (
        <div
          className="card"
          style={{ textAlign: "center", padding: "48px 24px" }}
        >
          <p style={{ color: "var(--text-muted)" }}>{t("loading")}</p>
        </div>
      )}

      {error && (
        <div className="card" style={{ borderColor: "var(--red)" }}>
          <p style={{ color: "var(--red)", fontSize: "14px" }}>{error}</p>
        </div>
      )}

      {!loading && data && (
        <>
          {/* Summary stats */}
          <div className="grid-3" style={{ marginBottom: "24px" }}>
            <div className="stat-card">
              <span className="stat-label">
                {t("matchesFound", { count: data.matches.length })}
              </span>
              <span className="stat-value neutral">{data.matches.length}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">
                {t("unmatchedOut", { count: data.unmatchedOut })}
              </span>
              <span className="stat-value neutral">{data.unmatchedOut}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">
                {t("unmatchedIn", { count: data.unmatchedIn })}
              </span>
              <span className="stat-value neutral">{data.unmatchedIn}</span>
            </div>
          </div>

          {data.matches.length === 0 ? (
            <div
              className="card"
              style={{ textAlign: "center", padding: "48px 24px" }}
            >
              <p
                style={{
                  fontSize: "16px",
                  fontWeight: 500,
                  marginBottom: "8px",
                }}
              >
                {t("noMatches")}
              </p>
              <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                {t("noMatchesHint")}
              </p>
            </div>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              {data.matches.map((match) => {
                const key = `${match.outTx.id}-${match.inTx.id}`;
                const isActioning = actionLoading === key;
                const fb = feedback?.key === key ? feedback.message : null;

                return (
                  <div
                    key={key}
                    className="card"
                    style={{
                      opacity: fb ? 0.6 : 1,
                      transition: "opacity 0.3s",
                    }}
                  >
                    {fb && (
                      <div
                        style={{
                          textAlign: "center",
                          padding: "8px",
                          background: "var(--bg-surface)",
                          borderRadius: "var(--radius-sm)",
                          marginBottom: "12px",
                          fontSize: "14px",
                          color: "var(--green)",
                        }}
                      >
                        {fb}
                      </div>
                    )}

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto 1fr",
                        gap: "16px",
                        alignItems: "center",
                        marginBottom: "16px",
                      }}
                    >
                      {/* OUT side */}
                      <div
                        style={{
                          padding: "16px",
                          background: "var(--bg-surface)",
                          borderRadius: "var(--radius-sm)",
                          borderLeft: "3px solid var(--red)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "11px",
                            color: "var(--text-muted)",
                            marginBottom: "4px",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          {t("from")}
                        </div>
                        <div
                          style={{
                            fontSize: "14px",
                            fontWeight: 600,
                            marginBottom: "8px",
                            color: "var(--text-primary)",
                          }}
                        >
                          {match.outTx.sourceId}
                        </div>
                        <div
                          style={{
                            fontSize: "16px",
                            fontWeight: 700,
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          {formatAmount(match.outTx.amount)} {match.outTx.asset}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "var(--text-muted)",
                            marginTop: "4px",
                          }}
                        >
                          {new Date(match.outTx.timestamp).toLocaleString()}
                        </div>
                      </div>

                      {/* Arrow */}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "24px",
                            color: "var(--text-muted)",
                          }}
                        >
                          &rarr;
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            color: "var(--text-muted)",
                          }}
                        >
                          {formatTimeDiff(match.timeDiffMs, t)}
                        </span>
                        {match.amountDiff > 0.00000001 && (
                          <span
                            style={{
                              fontSize: "11px",
                              color: "var(--yellow, #eab308)",
                            }}
                          >
                            -{formatAmount(match.amountDiff)} fee
                          </span>
                        )}
                      </div>

                      {/* IN side */}
                      <div
                        style={{
                          padding: "16px",
                          background: "var(--bg-surface)",
                          borderRadius: "var(--radius-sm)",
                          borderLeft: "3px solid var(--green)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "11px",
                            color: "var(--text-muted)",
                            marginBottom: "4px",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          {t("to")}
                        </div>
                        <div
                          style={{
                            fontSize: "14px",
                            fontWeight: 600,
                            marginBottom: "8px",
                            color: "var(--text-primary)",
                          }}
                        >
                          {match.inTx.sourceId}
                        </div>
                        <div
                          style={{
                            fontSize: "16px",
                            fontWeight: 700,
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          {formatAmount(match.inTx.amount)} {match.inTx.asset}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "var(--text-muted)",
                            marginTop: "4px",
                          }}
                        >
                          {new Date(match.inTx.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div
                      style={{
                        display: "flex",
                        gap: "12px",
                        justifyContent: "flex-end",
                      }}
                    >
                      <button
                        className="btn"
                        style={{
                          background: "transparent",
                          border: "1px solid var(--border)",
                          color: "var(--text-muted)",
                          fontSize: "13px",
                        }}
                        onClick={() => handleDismiss(match)}
                        disabled={isActioning}
                      >
                        {isActioning ? t("dismissing") : t("dismiss")}
                      </button>
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: "13px" }}
                        onClick={() => handleConfirm(match)}
                        disabled={isActioning}
                      >
                        {isActioning ? t("confirming") : t("confirm")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
