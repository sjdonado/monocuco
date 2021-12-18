import React from 'react';
import { render } from '@testing-library/react';
import App from './App';

test('renders monocuco title', () => {
  const { getByText } = render(<App />);
  const titleElement = getByText(/Monocuco/i);
  expect(titleElement).toBeInTheDocument();
});
