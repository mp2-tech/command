const isPromise = (obj: any): boolean =>
  typeof obj === 'object' && 'then' in obj;

export interface Command<T> {
  result: T | undefined;
  execute(): Promise<void>;
}

export interface UndoableCommand<T> extends Command<T> {
  undo(): Promise<void>;
}

export type CommandResult<T extends Command<any>> =
  T extends Command<infer P>
  ? P | undefined
  : never;

export type CommandResults<T extends Command<any>[]> =
  { [P in keyof T]: CommandResult<Extract<T[P], Command<any>>> };

type IteratorReturnType<T> = T extends Iterator<any, infer U, any> ? U : never;

export const isUndoable = <T>(cmd: Command<T>) => 'undo' in cmd;

export const isCommand = <T>(cmd: any) => typeof cmd === 'object' && 'execute' in cmd;

export const invoke = async <T>(cmd: Command<T>): Promise<T | undefined> => {
  await cmd.execute();
  return cmd.result;
};

type ExcuteMethod<T> = () => Promise<T | undefined> | (T | undefined);
type UndoMethod<T> = (result: T | undefined) => Promise<void> | (T | undefined);

export function command<T>(excute: ExcuteMethod<T>): Command<T>;
export function command<T>(excute: ExcuteMethod<T>, undo: UndoMethod<T>): UndoableCommand<T>;
export function command<T>(excute: ExcuteMethod<T>, undo?: UndoMethod<T>): Command<T> | UndoableCommand<T> {
  const cmd = <UndoableCommand<T>> {
    result: undefined,
    async execute() {
      try {
        const task = excute();
        this.result = isPromise(task)
          ? await (task as Promise<T | undefined>)
          : task as (T | undefined);
      } catch (err) {
        if (isUndoable(this)) {
          await this.undo();
        }
        throw err;
      }
    },
    async undo() {
      const task = undo!(this.result);
      if (isPromise(task)) {
        await task;
      }
    },
  };
  if (!undo) {
    delete cmd.undo;
  }
  return cmd;
}

export function compose<F extends () => Iterator<any, any, any>>(fn: F): UndoableCommand<IteratorReturnType<ReturnType<F>>>;
export function compose<T extends Command<any>[]>(...cmds: T): UndoableCommand<CommandResults<T>>;
export function compose(...args: any[]): any {
  if (typeof args[0] === 'function') {
    return complexCompose(args[0]);
  }
  return normalCompose(...args);
}

const normalCompose = <T extends Command<any>[]>(...cmds: T): UndoableCommand<CommandResults<T>> => {
  const excutedCommands: Command<any>[] = [];
  return command(
    async () => {
      await Promise.all(cmds.map(async (cmd) => {
        await cmd.execute();
        excutedCommands.unshift(cmd);
      }));
      return <CommandResults<T>> cmds.map((cmd) => cmd.result);
    },
    async () => {
      for (let cmd of excutedCommands) {
        if (isUndoable(cmd)) {
          await (cmd as UndoableCommand<T>).undo();
        }
      }
    },
  );
};

const complexCompose = <F extends () => Iterator<any, any, any>>(fn: F): UndoableCommand<IteratorReturnType<ReturnType<F>>> => {
  const excutedCommands: Command<any>[] = [];
  return command(
    async () => {
      const gen = fn();
      let task: IteratorResult<any, any>;
      let result: any;
      do {
        task = gen.next(result);
        if (task.value instanceof Array) {
          await Promise.all(task.value.map(async (cmd) => {
            if (isCommand(cmd)) {
              await cmd.execute();
              excutedCommands.unshift(cmd);
            }
          }));
          result = task.value.map((cmd) => isCommand(cmd) ? cmd.result : cmd);
        } else {
          result = task.value;
          if (isCommand(task.value)) {
            await task.value.execute();
            result = task.value.result;
            excutedCommands.unshift(task.value);
          }
        }
      } while(!task.done);
      return result;
    },
    async () => {
      for (let cmd of excutedCommands) {
        if (isUndoable(cmd)) {
          await (cmd as UndoableCommand<any>).undo();
        }
      }
    },
  );
};
