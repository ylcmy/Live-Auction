import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { validateProduct } from '../ProductForm';

// Mock RuleConfig to isolate ProductForm rendering tests.
// We do NOT call onChange during render to avoid a jsdom hang caused by
// React state updates triggered outside act() in this environment.
vi.mock('../RuleConfig', () => {
  return {
    __esModule: true,
    default: () => <div data-testid="rule-config-stub" />,
    validateRuleConfig: () => [],
  };
});

import ProductForm from '../ProductForm';

describe('ProductForm', () => {
  // -- validateProduct (pure function unit tests) -------------------------

  describe('validateProduct', () => {
    it('returns error when name is empty', () => {
      const errors = validateProduct({ name: '', description: '', imageUrl: '', category: '' });
      expect(errors.name).toBe('商品名称不能为空');
    });

    it('returns error when name is only whitespace', () => {
      const errors = validateProduct({ name: '   ', description: '', imageUrl: '', category: '' });
      expect(errors.name).toBe('商品名称不能为空');
    });

    it('returns error when name exceeds 100 characters', () => {
      const errors = validateProduct({
        name: 'a'.repeat(101),
        description: '',
        imageUrl: '',
        category: '',
      });
      expect(errors.name).toBe('商品名称不能超过 100 个字符');
    });

    it('returns no name error for valid name', () => {
      const errors = validateProduct({ name: '有效名称', description: '', imageUrl: '', category: '' });
      expect(errors.name).toBeUndefined();
    });

    it('returns error when description exceeds 2000 characters', () => {
      const errors = validateProduct({
        name: '有效名称',
        description: 'a'.repeat(2001),
        imageUrl: '',
        category: '',
      });
      expect(errors.description).toBe('商品描述不能超过 2000 个字符');
    });

    it('returns no errors for valid input', () => {
      const errors = validateProduct({
        name: '测试商品',
        description: '这是描述',
        imageUrl: 'https://example.com/img.jpg',
        category: '电子产品',
      });
      expect(errors).toEqual({});
    });
  });

  // -- Component rendering ------------------------------------------------

  it('renders name, description, imageUrl and category inputs', () => {
    render(<ProductForm onSubmit={vi.fn()} />);

    expect(screen.getByLabelText(/商品名称/)).toBeInTheDocument();
    expect(screen.getByLabelText(/商品描述/)).toBeInTheDocument();
    expect(screen.getByLabelText(/图片 URL/)).toBeInTheDocument();
    expect(screen.getByLabelText(/分类/)).toBeInTheDocument();
  });

  it('renders the submit button', () => {
    render(<ProductForm onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /创建商品/ })).toBeInTheDocument();
  });

  it('updates input value on change', () => {
    render(<ProductForm onSubmit={vi.fn()} />);

    const nameInput = screen.getByLabelText(/商品名称/) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: '新商品名' } });
    expect(nameInput.value).toBe('新商品名');
  });
});
