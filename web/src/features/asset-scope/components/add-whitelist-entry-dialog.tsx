import { useState, type FormEvent } from 'react';

import { Button, Dialog, Input, Select } from '@/shared/components';
import {
  type WhitelistEntryInput,
  useAddWhitelistEntry,
} from '../hooks/use-add-whitelist-entry';

export interface AddWhitelistEntryDialogProps {
  open: boolean;
  groupId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

type EntryKind = WhitelistEntryInput['kind'];

export function AddWhitelistEntryDialog({
  open,
  groupId,
  onClose,
  onSuccess,
}: AddWhitelistEntryDialogProps) {
  const [kind, setKind] = useState<EntryKind>('root_domain');
  const [rootDomain, setRootDomain] = useState('');
  const [allowSubdomains, setAllowSubdomains] = useState(true);
  const [cidr, setCidr] = useState('');
  const [ip, setIp] = useState('');
  const mutation = useAddWhitelistEntry();

  if (!open) return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    let entry: WhitelistEntryInput;
    if (kind === 'root_domain') {
      if (!rootDomain.trim()) return;
      entry = { kind, rootDomain: rootDomain.trim(), allowSubdomains };
    } else if (kind === 'cidr') {
      if (!cidr.trim()) return;
      entry = { kind, cidr: cidr.trim() };
    } else {
      if (!ip.trim()) return;
      entry = { kind, ip: ip.trim() };
    }
    mutation.mutate(
      { groupId, entry },
      {
        onSuccess: () => {
          onSuccess?.();
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open={open} onClose={onClose} title="新增白名单条目">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3" data-testid="add-whitelist-form">
        <label className="flex flex-col gap-1 text-sm">
          类型
          <Select
            value={kind}
            onChange={(event) => setKind(event.target.value as EntryKind)}
            data-testid="add-whitelist-kind"
          >
            <option value="root_domain">根域名</option>
            <option value="cidr">CIDR</option>
            <option value="ip">单 IP</option>
          </Select>
        </label>
        {kind === 'root_domain' ? (
          <>
            <label className="flex flex-col gap-1 text-sm">
              根域名
              <Input
                value={rootDomain}
                onChange={(event) => setRootDomain(event.target.value)}
                placeholder="example.com"
                data-testid="add-whitelist-root-domain"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowSubdomains}
                onChange={(event) => setAllowSubdomains(event.target.checked)}
                data-testid="add-whitelist-allow-subdomains"
              />
              允许子域
            </label>
          </>
        ) : null}
        {kind === 'cidr' ? (
          <label className="flex flex-col gap-1 text-sm">
            CIDR
            <Input
              value={cidr}
              onChange={(event) => setCidr(event.target.value)}
              placeholder="10.0.0.0/16"
              data-testid="add-whitelist-cidr"
            />
          </label>
        ) : null}
        {kind === 'ip' ? (
          <label className="flex flex-col gap-1 text-sm">
            IP
            <Input
              value={ip}
              onChange={(event) => setIp(event.target.value)}
              placeholder="10.0.0.42"
              data-testid="add-whitelist-ip"
            />
          </label>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            type="submit"
            disabled={mutation.isPending}
            data-testid="add-whitelist-submit"
          >
            提交
          </Button>
        </div>
        {mutation.isError ? (
          <p className="text-sm text-red-700">{mutation.error.message}</p>
        ) : null}
      </form>
    </Dialog>
  );
}
