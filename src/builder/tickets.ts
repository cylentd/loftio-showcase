/** Default starting allowance; a caller may supply another. */
export const FREE_BUILDS = 1;
const STORAGE_KEY = 'loftio-build-tickets-v1';
type Storage = { getItem(key: string): string | null; setItem(key: string, value: string): void };
// open: request IDs that spent a ticket and have not settled yet, so only they can be refunded, and only once.
// day: the last day key a daily refill ran (online mode); absent in ledgers saved before refills existed.
type Ledger = { version: 1; balance: number; open: string[]; day?: string };

const count = (value: unknown) => Number.isInteger(value) && (value as number) >= 0;

function restore(raw: string | null, initial: number): Ledger {
  if (raw === null) return { version: 1, balance: initial, open: [] };
  const value = JSON.parse(raw);
  if (value?.version !== 1 || !count(value.balance) || !Array.isArray(value.open)
    || value.open.some((id: unknown) => typeof id !== 'string')
    || (value.day !== undefined && typeof value.day !== 'string')) throw Error('Invalid build tickets');
  return { version: 1, balance: value.balance, open: [...value.open], ...(value.day === undefined ? {} : { day: value.day }) };
}

/** Build tickets: each new image costs one. Every call re-reads storage, so a second tab sees a spend at once. */
export function buildTickets(storage: Storage, key = STORAGE_KEY, initial = FREE_BUILDS) {
  if (!count(initial)) throw Error('Invalid initial ticket allowance');
  const read = () => restore(storage.getItem(key), initial);
  // Persist the initial allowance once; existing ledgers retain their balance and pending requests.
  const write = (ledger: Ledger) => storage.setItem(key, JSON.stringify(ledger));
  write(read());
  return {
    count: () => read().balance,
    spend(requestId: string) {
      const ledger = read();
      if (ledger.balance < 1) return false;
      write({ ...ledger, balance: ledger.balance - 1, open: [...ledger.open.filter(id => id !== requestId), requestId] });
      return true;
    },
    /** Nothing was made for this request: the ticket comes back. */
    refund(requestId: string) {
      const ledger = read();
      if (ledger.open.includes(requestId)) write({ ...ledger, balance: ledger.balance + 1, open: ledger.open.filter(id => id !== requestId) });
    },
    /** The request is finished, made or not: its ticket stays spent. */
    settle(requestId: string) {
      const ledger = read();
      if (ledger.open.includes(requestId)) write({ ...ledger, open: ledger.open.filter(id => id !== requestId) });
    },
    /** Online mode: once per day key, tops the balance up to cap. Never lowers it. */
    refillDaily(cap: number, today: string) {
      const ledger = read();
      if (ledger.day === today) return;
      write({ ...ledger, day: today, balance: Math.max(ledger.balance, cap) });
    },
    grant(amount: number) {
      if (!Number.isInteger(amount) || amount < 1) throw Error('Invalid ticket grant');
      const ledger = read(); write({ ...ledger, balance: ledger.balance + amount });
    },
  };
}
export type BuildTickets = ReturnType<typeof buildTickets>;
