import { mailIocKinds, type MailIoc, type MailIocKind } from '@/shared/contracts/mail-analysis.contract';

export interface IocListProps {
  iocs: MailIoc[];
}

const KIND_LABEL: Record<MailIocKind, string> = {
  URL: 'URL',
  DOMAIN: '域名',
  IP: 'IP',
  EMAIL: '邮箱',
};

export function groupIocs(iocs: MailIoc[]): Record<MailIocKind, string[]> {
  const result: Record<MailIocKind, string[]> = { URL: [], DOMAIN: [], IP: [], EMAIL: [] };
  for (const ioc of iocs) {
    result[ioc.kind].push(ioc.value);
  }
  return result;
}

export function IocList({ iocs }: IocListProps) {
  if (iocs.length === 0) {
    return (
      <p
        className="rounded border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500"
        data-testid="mail-ioc-empty"
      >
        未提取到 IOC。
      </p>
    );
  }

  const grouped = groupIocs(iocs);
  return (
    <div className="space-y-3" data-testid="mail-ioc-grouped">
      {mailIocKinds.map((kind) => {
        const values = grouped[kind];
        if (values.length === 0) return null;
        return (
          <section key={kind} data-testid={`mail-ioc-section-${kind}`}>
            <h4 className="text-xs font-semibold uppercase text-gray-500">{KIND_LABEL[kind]}</h4>
            <ul className="mt-1 space-y-0.5 text-sm font-mono text-gray-800">
              {values.map((value) => (
                <li key={value}>{value}</li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
