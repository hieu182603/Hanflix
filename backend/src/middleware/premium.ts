import type { RequestHandler } from 'express';
import { requireAuth } from './auth.js';
import { freeSampleIds, hasPremium, premiumRequired } from '../services/premium.js';
import { asyncHandler } from '../utils/async-handler.js';
import { assertLessonHsk, learnerHsk } from '../services/lesson-access.js';

export const optionalAuth: RequestHandler = (req, res, next) => {
  if (req.auth || !req.header('authorization')) return next();
  return requireAuth(req, res, next);
};

export const requirePremium: RequestHandler = (req, _res, next) => {
  if (!hasPremium(req.auth)) {
    const isExpiredTrial = Boolean(req.auth?.premiumTrial && new Date(req.auth.premiumTrial.endsAt) <= new Date());
    return next(premiumRequired(isExpiredTrial ? 'TRIAL_EXPIRED' : 'PREMIUM_REQUIRED'));
  }
  next();
};

export const requireLessonAccess: RequestHandler = asyncHandler(async (req, _res, next) => {
  const hsk = learnerHsk(req.auth);
  await assertLessonHsk(req.auth, String(req.params.lessonId));
  if (!hasPremium(req.auth) && !(await freeSampleIds(hsk)).includes(String(req.params.lessonId))) {
    const isExpiredTrial = Boolean(req.auth?.premiumTrial && new Date(req.auth.premiumTrial.endsAt) <= new Date());
    throw premiumRequired(isExpiredTrial ? 'TRIAL_EXPIRED' : 'PREMIUM_REQUIRED');
  }
  next();
});

export const requireLessonHsk: RequestHandler = asyncHandler(async (req, _res, next) => {
  await assertLessonHsk(req.auth, String(req.params.lessonId));
  next();
});
