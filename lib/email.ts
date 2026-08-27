import { waitUntil } from "@vercel/functions";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

async function deliverPasswordResetEmail(input: { to: string; name: string; url: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Password reset email delivery is not configured.");

  const from = process.env.RESEND_FROM_EMAIL ?? "Ruang Riset <onboarding@resend.dev>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: "Atur ulang password Ruang Riset",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#183044">
          <h1 style="font-family:Georgia,serif">Atur ulang password</h1>
          <p>Halo ${escapeHtml(input.name)},</p>
          <p>Kami menerima permintaan untuk mengganti password akun Ruang Riset Anda.</p>
          <p style="margin:28px 0"><a href="${escapeHtml(input.url)}" style="background:#e76f36;color:#fff;padding:12px 18px;text-decoration:none;border-radius:6px">Buat password baru</a></p>
          <p style="font-size:13px;color:#687378">Tautan berlaku selama 1 jam. Abaikan email ini jika Anda tidak meminta perubahan password.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    throw new Error(`Password reset email delivery failed with status ${response.status}.`);
  }
}

export async function sendPasswordResetEmail(input: { to: string; name: string; url: string }) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Password reset email delivery is not configured.");
  }

  const delivery = deliverPasswordResetEmail(input);
  if (process.env.VERCEL) {
    waitUntil(delivery);
    return;
  }
  await delivery;
}
