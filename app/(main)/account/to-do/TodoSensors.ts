"use client";
import { KeyboardSensor, MouseSensor, TouchSensor } from "@dnd-kit/core";
import { isTodoControl } from "@/lib/todo-interaction";

export class TodoMouseSensor extends MouseSensor {
  static activators = MouseSensor.activators.map(activator => ({ ...activator,
    handler: (event: Parameters<typeof activator.handler>[0], options: Parameters<typeof activator.handler>[1]) =>
      !isTodoControl(event.target, event.currentTarget) && activator.handler(event, options)
  }));
}
export class TodoTouchSensor extends TouchSensor {
  static activators = TouchSensor.activators.map(activator => ({ ...activator,
    handler: (event: Parameters<typeof activator.handler>[0], options: Parameters<typeof activator.handler>[1]) =>
      !isTodoControl(event.target, event.currentTarget) && activator.handler(event, options)
  }));
}
export class TodoKeyboardSensor extends KeyboardSensor {
  static activators = KeyboardSensor.activators.map(activator => ({ ...activator,
    handler: (event: Parameters<typeof activator.handler>[0], options: Parameters<typeof activator.handler>[1], context: Parameters<typeof activator.handler>[2]) =>
      !isTodoControl(event.target, event.currentTarget) && activator.handler(event, options, context)
  }));
}
