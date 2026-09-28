import { createHash, randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { AppError } from '../errors/app-error.js';
import { AiConversationModel } from '../models/ai-conversation.model.js';
import { AiMessageModel } from '../models/ai-message.model.js';
import type { AiCue, ResolvedAiContext } from './lesson-ai-context.service.js';

export interface AiReply {
  answerVi: string;
  citations: AiCue[];
  grounding: 'transcript' | 'general' | 'none';
  contextStatus: ResolvedAiContext['status'] | 'general';
  context?: Omit<ResolvedAiContext, 'cues' | 'status'>;
  conversationId?: string;
  requestId: string;
}
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
export const conversationKey = (userId: string, context?: ResolvedAiContext) =>
  hash(`${userId}:${context?.lessonId ?? 'general'}:${context?.subtitleRevision ?? 0}`);

export async function readAiHistory(userId: Types.ObjectId, context?: ResolvedAiContext) {
  const conversationId = conversationKey(userId.toString(), context);
  const messages = await AiMessageModel.find({ conversationId, userId, status: 'completed' })
    .sort({ createdAt: -1, _id: -1 }).limit(20).select('question response createdAt').lean();
  return { conversationId, messages: messages.reverse().map(m => ({
    id: m._id, question: m.question, response: m.response as AiReply, createdAt: m.createdAt,
  })) };
}

export async function clearAiHistory(userId: Types.ObjectId, context?: ResolvedAiContext) {
  const conversationId = conversationKey(userId.toString(), context);
  const marker = `clear:${randomUUID()}`;
  const conversation = await AiConversationModel.findOne({ _id: conversationId, userId }).lean();
  if (!conversation) return;
  const locked = await AiConversationModel.findOneAndUpdate({ _id: conversationId, userId,
    $or: [{ lockedUntil: null }, { lockedUntil: { $lte: new Date() } }],
  }, { $set: { pendingRequest: marker, lockedUntil: new Date(Date.now() + 120000) } }, { returnDocument: 'after' }).lean();
  if (!locked) throw new AppError(409, 'AI_CONVERSATION_BUSY', 'Hãy đợi Panda trả lời xong rồi xóa hội thoại.');
  try {
    await AiMessageModel.deleteMany({ conversationId, userId });
  } finally {
    await AiConversationModel.updateOne({ _id: conversationId, userId, pendingRequest: marker },
      { $set: { pendingRequest: null, lockedUntil: null } });
  }
}

export async function runAiConversation(input: {
  userId: Types.ObjectId; clientMessageId?: string; question: string;
  context?: ResolvedAiContext; note?: string;
  generate: (history: Array<{ question: string; answerVi: string; context?: AiReply['context']; citations: AiCue[] }>) => Promise<AiReply>;
}): Promise<AiReply> {
  const conversationId = conversationKey(input.userId.toString(), input.context);
  const requestId = hash(`${input.userId}:${input.clientMessageId ?? randomUUID()}`);
  const fingerprint = hash(JSON.stringify([conversationId, input.question, input.context, input.note]));
  const previous = await AiMessageModel.findOne({ _id: requestId, userId: input.userId }).lean();
  if (previous) {
    if (previous.fingerprint !== fingerprint) throw new AppError(409, 'AI_REQUEST_CONFLICT', 'Mã yêu cầu đã được dùng cho câu hỏi khác.');
    if (previous.status === 'completed') return previous.response as AiReply;
    if (previous.status === 'pending') throw new AppError(409, 'AI_REQUEST_PENDING', 'Câu hỏi này đang xử lý hoặc đã bị gián đoạn. Hãy tải lại hội thoại trước khi gửi câu hỏi mới.');
    // A failed request is only retried by an explicit new user submission.
    throw new AppError(409, 'AI_REQUEST_FAILED', 'Yêu cầu trước chưa hoàn tất. Hãy gửi lại câu hỏi để thử một yêu cầu mới.');
  }
  await AiConversationModel.updateOne({ _id: conversationId }, { $setOnInsert: {
    userId: input.userId, lessonId: input.context?.lessonId ?? null,
    subtitleRevision: input.context?.subtitleRevision ?? null,
  } }, { upsert: true });
  const lock = await AiConversationModel.findOneAndUpdate({
    _id: conversationId, userId: input.userId,
    $or: [{ lockedUntil: null }, { lockedUntil: { $lte: new Date() } }],
  }, { $set: { pendingRequest: requestId, lockedUntil: new Date(Date.now() + 120000) } }, { returnDocument: 'after' }).lean();
  if (!lock) throw new AppError(409, 'AI_CONVERSATION_BUSY', 'Panda đang trả lời một câu hỏi trong bài này. Hãy đợi rồi thử lại.');
  let created = false;
  try {
    await AiMessageModel.create({ _id: requestId, userId: input.userId, conversationId, fingerprint,
      question: input.question, status: 'pending' });
    created = true;
    const history = await readAiHistory(input.userId, input.context);
    const result = await input.generate(history.messages.slice(-6).map(m => ({
      question: m.question, answerVi: m.response.answerVi,
      context: m.response.context, citations: m.response.citations,
    })));
    const response = { ...result, conversationId, requestId };
    await AiMessageModel.updateOne({ _id: requestId, userId: input.userId, status: 'pending' },
      { $set: { status: 'completed', response } });
    return response;
  } catch (error) {
    if (created) await AiMessageModel.updateOne({ _id: requestId, userId: input.userId, status: 'pending' },
      { $set: { status: 'failed' } });
    throw error;
  } finally {
    await AiConversationModel.updateOne({ _id: conversationId, userId: input.userId, pendingRequest: requestId },
      { $set: { pendingRequest: null, lockedUntil: null } });
  }
}
