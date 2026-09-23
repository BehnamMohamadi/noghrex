import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signAuthToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, tokenVersion: user.tokenVersion },
    env.jwtSecret,
    { expiresIn: `${env.authCookieDays}d` }
  );
}

export function verifyAuthToken(token) {
  return jwt.verify(token, env.jwtSecret);
}
