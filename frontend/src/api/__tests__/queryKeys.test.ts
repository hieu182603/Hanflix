import { describe, expect, it } from 'vitest';
import {
  dashboardQueryKeys,
  learningQueryKeys,
  lessonQueryKeys,
  vocabularyQueryKeys,
} from '../queryKeys';

describe('query keys', () => {
  it('builds lesson query keys consistently', () => {
    expect(lessonQueryKeys.list({ page: 2 })).toEqual(['lessons', 'list', { page: 2 }]);
    expect(lessonQueryKeys.lesson('abc')).toEqual(['lesson', 'abc']);
    expect(lessonQueryKeys.subtitles('abc')).toEqual(['subtitles', 'abc']);
    expect(lessonQueryKeys.progress('abc')).toEqual(['progress', 'abc']);
    expect(lessonQueryKeys.quiz('abc')).toEqual(['quiz', 'abc']);
  });

  it('groups dashboard / learning / vocabulary keys under stable roots', () => {
    expect(dashboardQueryKeys.detail()).toEqual(['dashboard']);
    expect(learningQueryKeys.recsAi()).toEqual(['learning', 'recs', 'ai']);
    expect(learningQueryKeys.recsRule()).toEqual(['learning', 'recs', 'rule']);
    expect(vocabularyQueryKeys.saved()).toEqual(['vocabulary', 'saved']);
  });
});
