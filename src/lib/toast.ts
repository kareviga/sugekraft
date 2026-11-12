type L = (msg: string) => void;
const ls = new Set<L>();
export const toast = (msg: string) => ls.forEach(l => l(msg));
export const onToast = (l: L) => {
  ls.add(l);
  return () => {
    ls.delete(l);
  };
};
