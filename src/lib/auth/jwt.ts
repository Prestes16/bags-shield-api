/**
 * JWT utilities using jose (built-in with Next.js edge runtime).
 */
import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.AUTH_JWT_SECRET ?? "dev-secret-change-me"
);
const ALG = "HS256";
const EXP = "30d";

export interface AuthPayload {
  userId: string;
  wallets: string[];
  email?: string;
  displayName?: string;
  avatarUrl?: string;
}

export async function signToken(payload: AuthPayload): Promise<string> {
  return new SignJWT({ ...payload } as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(EXP)
    .setSubject(payload.userId)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<AuthPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: [ALG],
    });
    return {
      userId: String(payload.sub ?? payload.userId ?? ""),
      wallets: (payload.wallets as string[]) ?? [],
      email: payload.email ? String(payload.email) : undefined,
      displayName: payload.displayName
        ? String(payload.displayName)
        : undefined,
      avatarUrl: payload.avatarUrl ? String(payload.avatarUrl) : undefined,
    };
  } catch {
    return null;
  }
}
