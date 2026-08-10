"use client";

import { useEffect, useState } from "react";
import { applyActionCode } from "firebase/auth";
import { auth } from "../../../lib/firebase";

export default function EmailActionPage() {
  const [message, setMessage] = useState(
    "Verifying your email..."
  );

  useEffect(() => {
    const verifyEmail = async () => {
      const params = new URLSearchParams(
        window.location.search
      );

      const mode = params.get("mode");
      const oobCode = params.get("oobCode");

      if (
        !auth ||
        mode !== "verifyEmail" ||
        !oobCode
      ) {
        setMessage(
          "This verification link is invalid."
        );
        return;
      }

      try {
        await applyActionCode(auth, oobCode);

        window.location.replace(
          "/login?verified=1"
        );
      } catch (error) {
        console.error(
          "Email verification failed:",
          error
        );

        setMessage(
          "This verification link is invalid or expired."
        );
      }
    };

    void verifyEmail();
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#07111f",
        color: "#ffffff",
        padding: "24px"
      }}
    >
      <p>{message}</p>
    </main>
  );
}