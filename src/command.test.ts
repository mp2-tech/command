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
      assert.equal(await invoke(cmd), result);
    });

    it('should execute undo method when an error occurred', async () => {
      const spy = sinon.spy();
      const err = new Error('wtf');
      const cmd = command(
        async function() {
          throw err;
        },
        spy,
      );
      try {
        await invoke(cmd);
      } catch (actualErr) {
        assert.equal(actualErr, err);
        assert.ok(spy.calledOnce);
      }
    });
  });

  describe('compose', () => {
    describe('normal', () => {
      it('should return an array of command results', async () => {
        const cmd1 = command(() => 123);
        const cmd2 = command(() => 'test');
        const composedCmd = compose(cmd1, cmd2);
        await composedCmd.execute();
        assert.deepEqual(composedCmd.result, [123, 'test']);
      });
    });

    describe('complex', () => {
      it('should return the result of the given generator function', async () => {
        const cmd = compose(function* () {
          return 123;
        });
        await cmd.execute();
        assert.equal(cmd.result, 123);
      });

      it('should execute the returned command of the given generator function and return the command result', async () => {
        const cmd = compose(function* () {
          return command(() => 123);
        });
        await cmd.execute();
        assert.equal(cmd.result, 123);
      });

      it('should pass the result of yield command back to the yield statement', async () => {
        const cmd = compose(function* () {
          const result: number = yield command(() => 123);
          return result;
        });
        await cmd.execute();
        assert.equal(cmd.result, 123);
      });
    });
  });
});
