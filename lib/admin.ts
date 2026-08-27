export function parseEmailList(value: string | undefined) {
  return value
    ?.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean) ?? [];
}

export function getAdminEmails() {
  const explicitlyConfigured = parseEmailList(process.env.ADMIN_EMAILS);
  return new Set(
    explicitlyConfigured.length > 0
      ? explicitlyConfigured
      : parseEmailList(process.env.ALLOWED_SIGNUP_EMAILS),
  );
}

export function getBootstrapAllowedEmails() {
  return new Set([
    ...parseEmailList(process.env.ALLOWED_SIGNUP_EMAILS),
    ...getAdminEmails(),
  ]);
}

export function isAdminEmail(email: string | null | undefined) {
  return Boolean(email && getAdminEmails().has(email.trim().toLowerCase()));
}
