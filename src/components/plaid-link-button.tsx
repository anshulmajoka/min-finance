"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink, type PlaidLinkOnSuccess } from "react-plaid-link";
import { Button } from "@/components/ui/button";
import { Loader2, Landmark } from "lucide-react";

type PlaidLinkButtonProps = {
  disabled?: boolean;
  onConnected: (institutionName: string | null) => void;
  onError: (message: string) => void;
};

export function PlaidLinkButton({
  disabled,
  onConnected,
  onError,
}: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [exchanging, setExchanging] = useState(false);

  const prepareLink = useCallback(async () => {
    setPreparing(true);
    try {
      const response = await fetch("/api/plaid/create-link-token", {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not start Plaid Link.");
      }
      setLinkToken(data.link_token);
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Could not start Plaid Link.",
      );
    } finally {
      setPreparing(false);
    }
  }, [onError]);

  const onSuccess = useCallback<PlaidLinkOnSuccess>(
    async (publicToken, metadata) => {
      setExchanging(true);
      try {
        const institutionName = metadata.institution?.name ?? null;
        const response = await fetch("/api/plaid/exchange-public-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            public_token: publicToken,
            institution_name: institutionName,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Could not connect your bank.");
        }
        onConnected(institutionName);
      } catch (error) {
        onError(
          error instanceof Error
            ? error.message
            : "Could not connect your bank.",
        );
      } finally {
        setExchanging(false);
        setLinkToken(null);
      }
    },
    [onConnected, onError],
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: (err) => {
      if (err) {
        onError(err.display_message || err.error_message || "Link closed.");
      }
      setLinkToken(null);
    },
  });

  useEffect(() => {
    if (linkToken && ready) {
      open();
    }
  }, [linkToken, ready, open]);

  const busy = preparing || exchanging;

  return (
    <Button
      size="lg"
      disabled={disabled || busy}
      onClick={() => void prepareLink()}
      className="mint-cta h-12 gap-2 px-6 text-base font-medium shadow-none"
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Landmark className="size-4" />
      )}
      {exchanging
        ? "Connecting…"
        : preparing
          ? "Opening Plaid…"
          : "Connect a bank account"}
    </Button>
  );
}
