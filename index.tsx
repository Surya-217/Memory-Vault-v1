import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Memory Vault — Your Cinematic Memory Universe" },
      {
        name: "description",
        content:
          "Memory Vault is a magical emotional digital archive — store memories in glowing cosmic vaults with cinematic visuals.",
      },
    ],
  }),
});

function Index() {
  useEffect(() => {
    window.location.replace("/app.html");
  }, []);
  return (
    <div style={{ background: "#050816", color: "#b388ff", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui" }}>
      Entering the vault…
    </div>
  );
}
