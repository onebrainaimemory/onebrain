import { describe, it, expect } from 'vitest';
import {
  generateQuestionFromMemories,
  parseAnswerToMemories,
  QUESTION_TEMPLATES,
} from '../services/daily-question.service.js';

describe('daily-question', () => {
  describe('QUESTION_TEMPLATES', () => {
    it('should have templates for each memory type', () => {
      expect(QUESTION_TEMPLATES['fact']).toBeDefined();
      expect(QUESTION_TEMPLATES['preference']).toBeDefined();
      expect(QUESTION_TEMPLATES['goal']).toBeDefined();
      expect(QUESTION_TEMPLATES['experience']).toBeDefined();
      expect(QUESTION_TEMPLATES['decision']).toBeDefined();
      expect(QUESTION_TEMPLATES['skill']).toBeDefined();
    });

    it('should have at least 2 templates per type', () => {
      for (const type of Object.keys(QUESTION_TEMPLATES)) {
        expect(QUESTION_TEMPLATES[type]!.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('generateQuestionFromMemories', () => {
    it('should generate a question when memories exist', () => {
      const memories = [
        { type: 'fact', title: 'Works at Acme Corp', body: 'User works at Acme Corp' },
        { type: 'preference', title: 'Likes coffee', body: 'User prefers coffee' },
      ];

      const question = generateQuestionFromMemories(memories);
      expect(question).toBeDefined();
      expect(question.length).toBeGreaterThan(0);
    });

    it('should generate a default question when no memories exist', () => {
      const question = generateQuestionFromMemories([]);
      expect(question).toBeDefined();
      expect(question.length).toBeGreaterThan(0);
    });

    it('should generate a question referencing existing memory topics', () => {
      const memories = [
        { type: 'goal', title: 'Learn TypeScript', body: 'User wants to learn TS' },
      ];

      const question = generateQuestionFromMemories(memories);
      expect(question).toBeDefined();
    });
  });

  describe('parseAnswerToMemories', () => {
    it('should create memory items from a simple answer', () => {
      const result = parseAnswerToMemories(
        'What is something interesting about you?',
        'I grew up in Munich and studied computer science there',
      );

      expect(result).toHaveLength(1);
      expect(result[0]!.title).toBeDefined();
      expect(result[0]!.body).toBe('I grew up in Munich and studied computer science there');
      expect(result[0]!.type).toBe('fact');
      expect(result[0]!.sourceType).toBe('user_input');
    });

    it('should default to fact type', () => {
      const result = parseAnswerToMemories('Tell me something?', 'The sky is blue today');
      expect(result[0]!.type).toBe('fact');
    });

    it('should detect goal-related questions', () => {
      const result = parseAnswerToMemories(
        'What goals are you working toward?',
        'Learning to cook Italian food',
      );
      expect(result[0]!.type).toBe('goal');
    });

    it('should detect preference-related questions', () => {
      const result = parseAnswerToMemories(
        'What do you prefer for your workflow?',
        'I prefer dark mode editors',
      );
      expect(result[0]!.type).toBe('preference');
    });

    it('should not create items from empty answers', () => {
      const result = parseAnswerToMemories('A question?', '');
      expect(result).toHaveLength(0);
    });

    it('should not create items from very short answers', () => {
      const result = parseAnswerToMemories('A question?', 'ok');
      expect(result).toHaveLength(0);
    });
  });
});
