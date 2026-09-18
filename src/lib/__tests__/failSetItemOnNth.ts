import { vi } from "vitest";

/** n번째(1부터) setItem 호출에서 예외를 던지고, 나머지는 실제로 저장한다. spy를 돌려준다. */
export function failSetItemOnNth(n: number, errorName = "QuotaExceededError") {
  const original = Storage.prototype.setItem;
  let calls = 0;
  return vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(function (this: Storage, key: string, value: string) {
      calls += 1;
      if (calls === n) {
        const err = new Error("forced failure");
        err.name = errorName;
        throw err;
      }
      original.call(this, key, value);
    });
}
