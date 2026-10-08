// Registration is invite-only until billing and self-serve controls exist (PODO_SOCIAL.md section 18.11).
export async function POST() {
  return Response.json({ error: 'Registration is currently invite-only' }, { status: 403 });
}
