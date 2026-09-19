import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../config/env.js', () => ({env:{QUIZ_AUTO_GENERATION_ENABLED:true,GEMINI_API_KEY:'test',QUIZ_AUTO_GENERATION_KINDS:'comprehension'}}));
vi.mock('../models/lesson.model.js', () => ({LessonModel:{findById:vi.fn()}}));
vi.mock('../models/subtitle-track.model.js', () => ({SubtitleTrackModel:{findOne:vi.fn()}}));
vi.mock('../models/quiz.model.js', () => ({QuizModel:{findOneAndUpdate:vi.fn(),updateOne:vi.fn()}}));
vi.mock('./quiz-generator.js', () => ({generateQuizWithGemini:vi.fn()}));
import {LessonModel} from '../models/lesson.model.js';
import {SubtitleTrackModel} from '../models/subtitle-track.model.js';
import {QuizModel} from '../models/quiz.model.js';
import {generateQuizWithGemini} from './quiz-generator.js';
import {autoGenerateQuizForLesson} from './auto-quiz-generator.js';
const questions=(n:number)=>Array.from({length:n},(_,i)=>({questionId:`q${i}`,type:'fill_blank' as const,prompt:`Câu hỏi ${i}`,options:[],acceptedAnswers:['你好'],explanationVi:'Giải thích đầy đủ cho câu hỏi.'}));
beforeEach(()=>{
 vi.clearAllMocks();
 vi.mocked(LessonModel.findById).mockReturnValue({select:()=>({lean:async()=>({hsk:3,autoGenerateQuizCount:5})})} as never);
 vi.mocked(SubtitleTrackModel.findOne).mockReturnValue({sort:()=>({select:()=>({lean:async()=>({cues:[{cueId:'c1',zh:'你好',vi:'Xin chào'}]})})})} as never);
 vi.mocked(QuizModel.findOneAndUpdate).mockImplementation(()=>Object.assign(Promise.resolve({}),{lean:async()=>({_id:'quiz'})}) as never);
});
it('retries incomplete output and stores exactly the requested five questions',async()=>{
 vi.mocked(generateQuizWithGemini).mockResolvedValueOnce(questions(3)).mockResolvedValueOnce(questions(8));
 await autoGenerateQuizForLesson('507f1f77bcf86cd799439011');
 expect(generateQuizWithGemini).toHaveBeenCalledTimes(2);
 const updates=vi.mocked(QuizModel.findOneAndUpdate).mock.calls.map(c=>c[1] as any);
 const completed=updates.find(x=>x.$set?.aiGenerationStatus==='completed');
 expect(completed.$set.questions).toHaveLength(5);
});
it('marks short output failed instead of reporting completion or overwriting the draft',async()=>{
 vi.mocked(generateQuizWithGemini).mockResolvedValue(questions(3));
 await autoGenerateQuizForLesson('507f1f77bcf86cd799439011');
 expect(generateQuizWithGemini).toHaveBeenCalledTimes(3);
 const updates=vi.mocked(QuizModel.findOneAndUpdate).mock.calls.map(c=>c[1] as any);
 expect(updates.some(x=>x.$set?.aiGenerationStatus==='failed')).toBe(true);
 expect(updates.some(x=>x.$set?.questions)).toBe(false);
});
