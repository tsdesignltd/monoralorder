import { create } from "fontkit";
// pdf-lib expects fontkit 1's stream interface; fontkit 2 encodes synchronously.
// Keep the current CJK encoder and adapt only this interface.
export const pdfFontkit = {
  create(bytes: Uint8Array) {
    const font = create(bytes);
    const createSubset = font.createSubset.bind(font);
    font.createSubset = () => {
      const subset = createSubset();
      subset.encodeStream = () => {
        const handlers: Record<string, (value?: Uint8Array | unknown) => void> =
          {};
        const stream = {
          on(event: string, callback: (value?: Uint8Array | unknown) => void) {
            handlers[event] = callback;
            return stream;
          },
        };
        queueMicrotask(() => {
          try {
            handlers.data?.(subset.encode());
            handlers.end?.();
          } catch (e) {
            handlers.error?.(e);
          }
        });
        return stream;
      };
      return subset;
    };
    return font;
  },
};
