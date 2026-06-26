import "express";

declare global {
  namespace Express {
    interface Request {
      userHash?: string;
    }
  }
}
