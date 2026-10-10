'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getSetting, setSetting } from '@/lib/settingStore';

export interface User {
  id: string;
  nickname: string;
  role?: 'admin' | 'member';
}

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  login: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // 강제 리렌더링 및 권한 상태 변경 감지용 버전 상태
  const [roleVer, setRoleVer] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('ohome.auth.user.v1');
      if (raw) {
        setUser(JSON.parse(raw));
      }
    } catch {
      // 로딩 실패 시 무시
    }

    // 설정 변경이나 스토리지 이벤트를 감지하여 권한 상태 갱신
    const handleStorage = () => {
      setRoleVer(v => v + 1);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const login = (newUser: User) => {
    setUser(newUser);
    try {
      localStorage.setItem('ohome.auth.user.v1', JSON.stringify(newUser));
    } catch {
      // 저장 실패 무시
    }
    setRoleVer(v => v + 1);
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem('ohome.auth.user.v1');
    } catch {
      // 삭제 실패 무시
    }
    setRoleVer(v => v + 1);
  };

  // 관리자 권한 판별 로직
  // 1. 기본 아이디가 'admin'이거나 기존 유저 객체 role이 'admin'인 경우
  // 2. ohome.memberroles.v1 설정값에서 현재 유저 ID가 'admin'으로 지정된 경우
  const isAdmin = React.useMemo(() => {
    void roleVer; // 의존성 트리거용
    if (!user) return false;
    if (user.id === 'admin' || user.role === 'admin') return true;

    const memberRoles = getSetting<Record<string, string>>('ohome.memberroles.v1', {});
    return memberRoles[user.id] === 'admin';
  }, [user, roleVer]);

  return (
    <AuthContext.Provider value={{ user, isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// 가입코드 관리 관련 헬퍼 함수들
export function inviteCode(): string {
  return getSetting<string>('ohome.invite.v1', '1234');
}

export function setInviteCode(code: string): void {
  setSetting('ohome.invite.v1', code);
}
