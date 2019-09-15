import sinon from 'sinon';
import assert from 'assert';
import { command, compose, invoke, isCommand, isUndoable } from './command';

describe('command', () => {
  describe('command', () => {
    it('should create a command', () => {
      const cmd = command(async () => {});
      assert.ok(cmd.hasOwnProperty('execute'));
      assert.ok(isCommand(cmd));
      assert.ok(!isUndoable(cmd));
    });

    it('should create a undoable command', () => {
      const cmd = command(async () => {}, async () => {});
      assert.ok(cmd.hasOwnProperty('execute'));
      assert.ok(isCommand(cmd));
      assert.ok(isUndoable(cmd));
    });
  });

  describe('invoke', () => {
    it('should return the result', async () => {
      const result = 123;
      const cmd = command<number>(async () => {
        return result;
      });
      assert.strictEqual(await invoke(cmd), result);
    });

    it('should execute undo method when an error occurred', async () => {
      const spy = sinon.spy();
      const err = new Error('wtf');
      const cmd = command(async () => {
        throw err;
      }, spy);
      try {
        await invoke(cmd);
      } catch (actualErr) {
        assert.strictEqual(actualErr, err);
        assert.ok(spy.calledOnce);
      }
    });
  });

  describe('compose', () => {
    describe('normal', () => {
      it('should return an array of command results', async () => {
        const cmd1 = command(() => 123);
        const cmd2 = command(() => 'test');
        const composedCmd = compose(
          cmd1,
          cmd2
        );
        await composedCmd.execute();
        assert.deepStrictEqual(composedCmd.result, [123, 'test']);
      });
    });

    describe('complex', () => {
      it('should return the result of the given generator function', async () => {
        const cmd = compose(function*() {
          return 123;
        });
        await cmd.execute();
        assert.strictEqual(cmd.result, 123);
      });

      it('should execute the returned command of the given generator function and return the command result', async () => {
        const cmd = compose(function*() {
          return command(() => 123);
        });
        await cmd.execute();
        assert.strictEqual(cmd.result, 123);
      });

      it('should pass the result of yield command back to the yield statement', async () => {
        const cmd = compose(function*() {
          const result: number = yield command(() => 123);
          return result;
        });
        await cmd.execute();
        assert.strictEqual(cmd.result, 123);
      });

      it('should pass error back to generator function when command execution failed', async () => {
        const err = new Error('wtf');
        const cmd = compose(function*() {
          try {
            yield command(() => {
              throw err;
            });
          } catch (err) {
            return err;
          }
        });
        await cmd.execute();
        assert.strictEqual(cmd.result, err);
      });

      it('should undo executed commands', async () => {
        const noop = () => {};
        const spy1 = sinon.spy();
        const spy2 = sinon.spy();
        const spy3 = sinon.spy();
        const spy4 = sinon.spy();
        try {
          await compose(function*() {
            yield command(noop, spy1);
            yield command(noop, spy2);
            yield command(() => {
              throw new Error('wtf');
            }, spy3);
            yield command(noop, spy4);
          }).execute();
        } catch (err) {}
        assert.ok(spy1.calledOnce);
        assert.ok(spy2.calledOnce);
        assert.ok(spy3.calledOnce);
        assert.ok(!spy4.called);
      });

      it('should return an array of command results', async () => {
        const cmd1 = command(() => 1);
        const cmd2 = command(() => '2');
        const cmd3 = command(() => true);
        const composedCmd = compose(function*() {
          const res: [number, string, boolean] = yield [cmd1, cmd2, cmd3];
          return res;
        });
        await composedCmd.execute();
        assert.deepStrictEqual(composedCmd.result, [
          cmd1.result,
          cmd2.result,
          cmd3.result,
        ]);
      });
    });
  });
});
