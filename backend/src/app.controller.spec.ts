import { AppController } from './app.controller';

describe('AppController', () => {
  it('reports application health', () => {
    expect(new AppController().health()).toEqual({ status: 'ok' });
  });
});
