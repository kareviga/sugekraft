export interface ToastAction {
  label: string;
  run: () => void;
}
type L = (msg: string, action?: ToastAction) => void;
const ls = new Set<L>();
export const toast = (msg: string, action?: ToastAction) => ls.forEach(l => l(msg, action));
export const onToast = (l: L) => {
  ls.add(l);
  return () => {
    ls.delete(l);
  };
};
