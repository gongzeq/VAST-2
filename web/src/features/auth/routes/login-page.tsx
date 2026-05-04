import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ErrorState,
  Input,
  Select,
} from '@/shared/components';
import { useToast } from '@/shared/hooks/use-toast';
import { useCurrentActor } from '@/shared/hooks/use-current-actor';
import {
  labelForRole,
  presetRoleIds,
  type PresetRoleId,
} from '@/shared/auth/roles';

import { useLogin } from '../hooks/use-login';

export function LoginPage() {
  const navigate = useNavigate();
  const { actor } = useCurrentActor();
  const { pushToast } = useToast();
  const [username, setUsername] = useState('');
  const [roleId, setRoleId] = useState<PresetRoleId>('security-engineer');
  const login = useLogin();

  if (actor) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!username.trim()) {
      pushToast('warning', '请填写用户名');
      return;
    }
    login.mutate(
      { username: username.trim(), roleId },
      {
        onSuccess: () => {
          pushToast('success', `欢迎，${username}（${labelForRole(roleId)}）`);
          navigate('/', { replace: true });
        },
        onError: (err) => {
          pushToast('error', err.message);
        },
      },
    );
  };

  return (
    <Card className="w-full max-w-sm" data-testid="login-card">
      <CardHeader>
        <CardTitle>Mock 登录</CardTitle>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            用户名
            <Input
              data-testid="login-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="alice"
              autoComplete="off"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            角色
            <Select
              data-testid="login-role"
              value={roleId}
              onChange={(event) => setRoleId(event.target.value as PresetRoleId)}
            >
              {presetRoleIds.map((role) => (
                <option key={role} value={role}>
                  {labelForRole(role)}（{role}）
                </option>
              ))}
            </Select>
          </label>
          <Button
            type="submit"
            disabled={login.isPending}
            data-testid="login-submit"
          >
            {login.isPending ? '登录中…' : '登录'}
          </Button>
          {login.isError ? (
            <ErrorState description={login.error.message} />
          ) : null}
        </form>
      </CardBody>
    </Card>
  );
}
