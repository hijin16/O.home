'use client';
// 환경설정 (기획서 5장) — 0차: 「디자인」 탭(테마) 실동작.
// 나머지 카테고리는 해당 기능 마일스톤에서 함께 구현.
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth, inviteCode, setInviteCode } from '@/lib/auth';
import { useMembers } from '@/lib/members';
import { useTheme } from '@/lib/ThemeProvider';
import { ThemeVars } from '@/lib/theme';
import { ColorField } from '@/components/ui/ColorField';
import { KStep, KToggle, KInput, LiveInput, KTextarea, KSelect, KCheck, Pager } from '@/components/ui/Kit';
import { DragList } from '@/components/ui/DragList';
import { useMainStore, WidgetConf, WIDGET_META, MULTI_TYPES, widgetLabel } from '@/lib/mainStore';
import { useConfirmDelete, ConfirmModal, Modal } from '@/components/ui/Modal';
import { exportBackup, importBackup, resetGroups, RESET_CONTENT, RESET_EXTRA } from '@/lib/backup';
import { DiaryPost, DIARY_SEED } from '@/lib/diaryStore';
import { newId } from '@/lib/postStore';
import { useCommSettings, badgeStyle, CommBadge, CommSettings } from '@/lib/commStore';
import {
  useBoardSettings, boardBadgeStyle, BoardBadge, galleryCatsOf,
  useBoards, Board, BoardSkin, BoardPerm, DEFAULT_BOARD_CATS, MAIN_BOARD_ID,
} from '@/lib/boardStore';
import { useThreadSettings, ThreadWork, THREAD_SEED, ThreadCat, threadBadgeStyle, threadCats, threadCatsPatch } from '@/lib/threadStore';
import { useTrpgSettings, DOTORI_STATUS_KEYS, DotoriStatus, dotoriBadgeStyle } from '@/lib/galleryStore';
import { useMemoSettings } from '@/lib/memoStore';
import {
  useMenuSettings, MenuSettings, MenuPerm, MenuVis, PLAYLOG_COLS,
  MenuGroupNode, MenuLeaf, defaultTree, newGroupId, menuLabelFor, extraBoardHref, boardEntries,
  IMG_PROTECT_AREAS,
} from '@/lib/menuStore';
import { FEATURES } from '@/lib/menu';
import { SectionsBlock } from '@/components/settings/SectionList';
import { useSections, sectionsOf, sectionMenuEntries, MAIN_SEC, inSection } from '@/lib/sectionStore';
import { useCustomLinks, linkEntries, toInternalPath } from '@/lib/linkStore';
import { useSiteDraft } from '@/lib/siteStore';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCursorSettings, CursorState, CURSOR_STATE_LABEL } from '@/lib/cursorStore';
import { RelQuestionSet, RELQ_SEED, RELQ_KEY, CP_LABEL } from '@/lib/relqStore';
import { SymbolInput } from '@/components/ui/SymbolInput';
import { allBlobs, putBlobAs, useBlobUrl, getBlob } from '@/lib/blobStore';
import { parseAni } from '@/lib/aniCursor';
import { fileDrop } from '@/lib/dnd';
import { Character, CHAR_SEED, Relation, REL_SEED } from '@/lib/charStore';
import { useLocalList } from '@/lib/postStore';
import { Mood, MOOD_SEED, moodTint } from '@/lib/diaryStore';
import {
  TextSettingEditor, DdayEditor, TodoEditor, BannerEditor, DecoEditor,
} from '@/components/main/widgetEditors';
import { useBgm, BgmTrack, parseVideoId } from '@/lib/bgmStore';
import { useFonts, fontCssUrl, FontDef, FontRole, ROLE_LABEL, FOLLOW_MENU, FOLLOW_TITLE } from '@/lib/fontStore';
import { useToast } from '@/components/ui/Toast';
import { PageTitle, EditableDesc, getPageText, setPageText } from '@/components/ui/PageText';
import { putBlob } from '@/lib/blobStore';
import { getSetting, setSetting, pushLocalSettings, unsyncedSettingKeys, SETTING_KEYS } from '@/lib/settingStore';
import { isServerMode, createBackend, backend } from '@/lib/backend';
import type { BackendConfig, BackendKind } from '@/lib/backend/types';
import { CONTENT_COLLECTIONS } from '@/lib/backend/types';
import { visFloorOf } from '@/lib/visFloor';
import { validateConfig, configFileText, saveLocalConfig, parseFirebaseSnippet, serverConfig, serverConfigSource } from '@/lib/serverConfig';
import { migrateTo, findOrphanFiles } from '@/lib/transfer';
import { FIRESTORE_RULES, STORAGE_RULES } from '@/lib/firebaseRules';
import { SCHEMA_SQL } from '@/lib/schemaSql';

const CATEGORIES = [
  '디자인', '메인 페이지', '위젯', '메뉴 관리', '게시판 관리', '자관 질문', '커미션', 'TRPG', '감상타래', '메모장',
  '폰트', '마우스 커서', 'BGM', '무드 리스트', '회원/보안', '데이터 백업',
] as const;

/** 색 항목 한 쌍 렌더 헬퍼 */
function CP({ label, k, def }: { label?: string; k: keyof ThemeVars; def?: string }) {
  const { state, setVar } = useTheme();
  return (
    <>
      {label && <span className="cp-lb">{label}</span>}
      <ColorField value={String(state.vars[k] ?? def ?? '#888888')} onChange={hex => setVar(k, hex as never)} />
    </>
  );
}

function WidgetStyleRow() {
  const { state, setVar } = useTheme();
  const v = state.vars;
  return (
    <div className="set-row" style={{ flexWrap: 'wrap' }}>
      <div className="l"><b>위젯</b>
        <small>메인·사이드에 얹히는 카드 — 비워 두면 카드 색을 그대로 따라갑니다</small></div>
      <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
        <div className="cp-grid2">
          <CP label="배경" k="wgBg" def={v.cardBg ?? '#fbfbfc'} />
          <CP label="타이틀" k="wgTitle" def={v.pageDesc ?? '#8a8f98'} />
          <CP label="본문" k="wgFg" def={v.cardFg ?? '#1d2025'} />
        </div>
        <div className="cf-row" style={{ justifyContent: 'flex-end' }}>
          <KCheck label="테두리" checked={!!v.wgBorder} onChange={b => setVar('wgBorder', b)} />
          {v.wgBorder && <CP label="색" k="wgBd" def="#e6e8ec" />}
        </div>
      </div>
    </div>
  );
}

function FontRoleRow({ role }: { role: FontRole }) {
  const { fonts, roles, setRole, familyOf } = useFonts();
  const cfg = roles[role];
  const wBtn = (w: number | undefined, label: string) => (
    <button className={cfg.weight === w ? 'on' : ''} onClick={() => setRole(role, { weight: w })}>{label}</button>
  );
  return (
    <div className="set-row" style={{ flexWrap: 'wrap' }}>
      <div className="l"><b>{ROLE_LABEL[role].label}</b>{ROLE_LABEL[role].desc && <small>{ROLE_LABEL[role].desc}</small>}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <KSelect minWidth={170} value={cfg.id} onChange={v => setRole(role, { id: v })}
          options={[
            ...(role === 'dropdown' ? [{ value: FOLLOW_MENU, label: <span>메뉴 폰트와 동일</span> }] : []),
            ...(role === 'pagetitle' ? [{ value: FOLLOW_TITLE, label: <span>타이틀 폰트와 동일</span> }] : []),
            ...fonts.map(f => ({ value: f.id, label: <span style={{ fontFamily: familyOf(f.id) }}>{f.name}</span> })),
          ]} />
        <div className="mini-seg">
          {wBtn(undefined, '기본')}
          {wBtn(300, '가늘게')}
          {wBtn(400, '보통')}
          {wBtn(700, '굵게')}
        </div>
        <KStep value={cfg.scale ?? 100} min={80} max={130} step={5} suffix="%"
          onChange={v => setRole(role, { scale: v })} />
      </div>
    </div>
  );
}

function DesignPane() {
  const {
    state, dirty: themeDirty, setMode, setPointAccent, setPointTone, setVar,
    resetMode, save, discard, presets, savePreset, applyPreset, removePreset,
  } = useTheme();
  const siteDraft = useSiteDraft();
  const { rolesDirty, saveRoles, discardRoles } = useFonts();
  const dirty = themeDirty || siteDraft.dirty || rolesDirty;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const toast = useToast();
  const del = useConfirmDelete();
  const [resetOpen, setResetOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presetSel, setPresetSel] = useState('');
  const modeBtn = (m: typeof state.mode, label: string) => (
    <button className={state.mode === m ? 'on' : ''} onClick={() => setMode(m)}>{label}</button>
  );
  return (
    <div className="set-sec">
      <h3>테마</h3>
      <div className="d">변경은 미리보기로만 반영 — [SAVE]를 눌러야 저장 · 모드마다 수정값을 따로 기억합니다</div>

      <div className="set-row">
        <div className="l"><b>모드</b><small>전환해도 각 모드의 수정값은 유지 — 초기화는 [선택 리셋]에서 모드별로</small></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="seg in-panel">
            {modeBtn('light', '라이트')}
            {modeBtn('dark', '다크')}
            {modeBtn('point', '포인트 자동')}
            {modeBtn('custom', '커스텀')}
          </div>
          <button className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: 11 }}
            onClick={() => setResetOpen(true)}>선택 리셋</button>
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>저장</b><small>화면에는 바로 보이지만 <b>SAVE를 눌러야 실제로 저장</b>됩니다 — 색·폰트·로고·탭 제목 모두</small></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {dirty && <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>저장 안 된 변경</span>}
          <button className="btn btn-ghost" style={{ height: 35, padding: '0 14px', fontSize: 11, opacity: dirty ? 1 : 0.45 }}
            disabled={!dirty} onClick={() => { discard(); siteDraft.discard(); discardRoles(); toast('저장된 테마로 되돌렸습니다'); }}>변경 취소</button>
          <button className="btn btn-dark" style={{ padding: '0 18px', fontSize: 11, opacity: dirty ? 1 : 0.45 }}
            disabled={!dirty} onClick={() => { save(); siteDraft.save(); saveRoles(); toast('테마가 저장되었습니다'); }}>SAVE</button>
        </div>
      </div>

      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l"><b>테마 저장해두기</b><small>현재 색 구성을 이름으로 보관 — 적용하면 커스텀 모드에 불러옵니다</small></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {presets.length > 0 && (
            <>
              <KSelect minWidth={140} value={presetSel} onChange={setPresetSel}
                options={[{ value: '', label: '저장한 테마' }, ...presets.map(p => ({ value: p.id, label: p.name }))]} />
              <button className="btn btn-ghost" style={{ height: 35, padding: '0 14px', fontSize: 11 }}
                onClick={() => { if (presetSel) { applyPreset(presetSel); toast('커스텀 모드에 적용했습니다 — 저장하려면 SAVE'); } }}>APPLY</button>
              <button className="btn btn-ghost" style={{ height: 35, padding: '0 14px', fontSize: 11, marginRight: 10 }}
                onClick={() => {
                  const p = presets.find(x => x.id === presetSel);
                  if (p) del.ask(`테마 「${p.name}」를 삭제하시겠습니까?`, () => { removePreset(p.id); setPresetSel(''); });
                }}>DELETE</button>
            </>
          )}
          <KInput placeholder="테마 이름" value={presetName} onChange={e => setPresetName(e.target.value)}
            style={{ width: 120, height: 35, boxSizing: 'border-box' }} />
          <button className="btn btn-ghost" style={{ height: 35, padding: '0 14px', fontSize: 11 }}
            onClick={() => {
              if (!presetName.trim()) { toast('테마 이름을 입력해 주세요'); return; }
              savePreset(presetName.trim());
              setPresetName('');
              toast('테마가 보관함에 저장되었습니다');
            }}>KEEP</button>
        </div>
      </div>

      <ConfirmModal open={resetOpen} wide title="어떤 테마를 초기화할까요?"
        body="선택한 모드의 수정값만 초기 상태로 돌아갑니다. 확정은 [SAVE]를 눌러야 저장됩니다."
        onClose={() => setResetOpen(false)}
        buttons={[
          { label: '라이트', kind: 'ghost', onClick: () => { resetMode('light'); setResetOpen(false); } },
          { label: '다크', kind: 'ghost', onClick: () => { resetMode('dark'); setResetOpen(false); } },
          { label: '포인트 자동', kind: 'ghost', onClick: () => { resetMode('point'); setResetOpen(false); } },
          { label: '커스텀', kind: 'ghost', onClick: () => { resetMode('custom'); setResetOpen(false); } },
          { label: 'CANCEL', kind: 'dark', onClick: () => setResetOpen(false) },
        ]} />
      {del.element}

      <div className="set-row">
        <div className="l"><b>포인트 자동 톤</b><small>포인트 자동 모드를 다크 느낌으로 깔지, 라이트 느낌으로 깔지</small></div>
        <div className="mini-seg">
          <button className={state.pointTone === 'dark' ? 'on' : ''} onClick={() => setPointTone('dark')}>다크 느낌</button>
          <button className={state.pointTone === 'light' ? 'on' : ''} onClick={() => setPointTone('light')}>라이트 느낌</button>
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>포인트 컬러</b><small>포인트 자동 모드의 기준색 — 변경 즉시 전체 재파생</small></div>
        <div className="cp-group">
          <ColorField value={state.vars.accent}
            onChange={hex => state.mode === 'point' ? setPointAccent(hex) : setVar('accent', hex)} />
        </div>
      </div>

      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l"><b>배경</b><small>그라데이션(시작→끝·각도) 또는 이미지(업로드·블러)</small></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div className="mini-seg">
            <button className={(state.vars.bgType ?? 'gradient') === 'gradient' ? 'on' : ''}
              onClick={() => setVar('bgType', 'gradient')}>그라데이션</button>
            <button className={state.vars.bgType === 'image' ? 'on' : ''}
              onClick={() => setVar('bgType', 'image')}>이미지</button>
          </div>
          {(state.vars.bgType ?? 'gradient') === 'gradient' ? (
            <>
              <CP k="bgG1" />
              <span style={{ color: 'var(--faint)', fontSize: 11 }}>→</span>
              <CP k="bgG2" />
              <span className="cp-lb">각도</span>
              <KStep value={state.vars.bgAngle ?? 180} min={0} max={360} step={15} suffix="°"
                onChange={v => setVar('bgAngle', v)} />
            </>
          ) : (
            <>
              <input id="themeBgFile" type="file" accept="image/*" style={{ display: 'none' }}
                onChange={async e => {
                  const f = e.target.files?.[0];
                  if (f) setVar('bgImageId', await putBlob(f));
                  e.target.value = '';
                }} />
              <button className="btn btn-ghost" style={{ height: 35, padding: '0 14px', fontSize: 11 }}
                onClick={() => document.getElementById('themeBgFile')?.click()}>
                {state.vars.bgImageId ? 'CHANGE' : 'UPLOAD'}
              </button>
              {state.vars.bgImageId && (
                <button className="btn btn-ghost" style={{ height: 35, padding: '0 14px', fontSize: 11 }}
                  onClick={() => setVar('bgImageId', undefined)}>REMOVE</button>
              )}
              <span className="cp-lb">블러</span>
              <KStep value={state.vars.bgBlur ?? 0} min={0} max={30} step={2} suffix="px"
                onChange={v => setVar('bgBlur', v)} />
            </>
          )}
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>카드</b><small>패널·게시판 리스트·필터 카드의 배경과 글씨색 — 보조 글씨색은 자동 파생</small></div>
        <div className="cp-group">
          <CP label="배경" k="cardBg" />
          <CP label="글씨" k="cardFg" />
        </div>
      </div>

      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l"><b>브라우저 탭 제목</b><small>탭·즐겨찾기에 표시되는 이름 — 비우면 「로고 텍스트 — 개인홈」</small></div>
        <DocTitleControl />
      </div>

      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l"><b>브라우저 탭 아이콘</b><small>탭·즐겨찾기에 표시되는 작은 그림 — 정사각형 PNG 권장, 비우면 기본 아이콘</small></div>
        <FaviconControl />
      </div>

      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l"><b>크롤링 설명 문구</b><small>카톡·디스코드 등에 링크 공유 시 제목 아래 뜨는 한 줄 — 비우면 서브타이틀, 그것도 비었으면 기본 문구</small></div>
        <CrawlDescControl />
      </div>

      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l"><b>로고</b><small>상단바 로고 텍스트·아랫줄 서브타이틀·정렬</small></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', flex: 1 }}>
          <LogoControls />
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <CP label="글씨" k="topBrand" />
          </div>
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>상단메뉴</b></div>
        <div className="cp-group">
          <CP label="배경" k="topBg" />
          <CP label="글씨" k="topFg" />
          <CP label="호버 글씨" k="topHv" />
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>하위메뉴 드롭다운</b></div>
        <div className="cp-group">
          <CP label="배경" k="ddBg" />
          <CP label="글씨" k="ddFg" />
          <CP label="호버" k="ddHv" />
        </div>
      </div>

      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l"><b>페이지 타이틀</b><small>각 메뉴 상단 큰 제목과 설명 문구</small></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div className="mini-seg">
            {(['both', 'title', 'desc', 'none'] as const).map(m => (
              <button key={m} className={(state.vars.pageHead ?? 'both') === m ? 'on' : ''}
                onClick={() => setVar('pageHead', m)}>
                {m === 'both' ? '둘 다' : m === 'title' ? '제목만' : m === 'desc' ? '설명만' : '안 띄움'}
              </button>
            ))}
          </div>
          <span className="cp-lb">모바일</span>
          <div className="mini-seg">
            <button className={(state.vars.pageHeadM ?? 'same') === 'same' ? 'on' : ''}
              onClick={() => setVar('pageHeadM', 'same')}>동일</button>
            <button className={state.vars.pageHeadM === 'none' ? 'on' : ''}
              onClick={() => setVar('pageHeadM', 'none')}>생략</button>
          </div>
          <CP label="제목" k="pageTitle" />
          <CP label="설명" k="pageDesc" />
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>BGM 플레이어</b></div>
        <div className="cp-group">
          <CP label="배경" k="bgmBg" />
          <CP label="글씨" k="bgmFg" />
          <CP label="아이콘" k="bgmIc" />
          <CP label="볼륨바" k="bgmVol" />
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>캐릭터 탭 리스트</b><small>캐릭터 상세 좌측 아이콘 탭</small></div>
        <div className="cp-grid2">
          <CP label="배경" k="tabBg" />
          <CP label="글씨" k="tabFg" />
          <CP label="선택 배경" k="tabOnBg" />
          <CP label="선택 글씨" k="tabOnFg" />
        </div>
      </div>

      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l"><b>입력 포커스</b><small>인풋·드롭다운을 선택했을 때의 테두리색과 강조 링</small></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', flex: 1 }}>
          <KInput style={{ width: 130, marginRight: 'auto' }} defaultValue="포커스 미리보기" />
          <CP label="색" k="focusColor" def={state.vars.accent} />
          <div className="mini-seg">
            <button data-tip="은은하게 번지는 링" className={(state.vars.focusRing ?? 'glow') === 'glow' ? 'on' : ''}
              onClick={() => setVar('focusRing', 'glow')}>번짐</button>
            <button data-tip="선명한 실선 링" className={state.vars.focusRing === 'line' ? 'on' : ''}
              onClick={() => setVar('focusRing', 'line')}>라인</button>
            <button data-tip="링 없이 테두리 색만 바뀜" className={state.vars.focusRing === 'none' ? 'on' : ''}
              onClick={() => setVar('focusRing', 'none')}>테두리만</button>
          </div>
          {(state.vars.focusRing ?? 'glow') !== 'none' && (
            <>
              <span className="cp-lb">두께</span>
              <KStep value={state.vars.focusW ?? 3} min={1} max={6} step={1} suffix="px"
                onChange={v => setVar('focusW', v)} />
            </>
          )}
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>이미지 편집 배경</b><small>썸네일·헤더 위치 지정 화면의 판 — 투명 이미지에서 보임</small></div>
        <div className="cp-group">
          <CP label="배경" k="cropBg" />
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>스티커 메모 보드</b><small>메모장 배치 판과 메인 미니보드 위젯의 배경</small></div>
        <div className="cp-group">
          <CP label="배경" k="memoBoard" />
          <CP label="테두리" k="memoBoardBd" />
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>스크롤바</b></div>
        <div className="cp-group">
          <CP label="색" k="sbThumb" />
          <CP label="테두리" k="sbBd" />
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>검색창</b><small>게시판·리스트 공통 검색 인풋 — 라이트/다크 전환 시 자동 연동</small></div>
        <div className="cp-grid2">
          <CP label="배경" k="searchBg" />
          <CP label="글씨" k="searchFg" />
          <CP label="아이콘" k="searchIc" />
          <CP label="테두리" k="searchBd" />
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>스위치 탭</b><small>게시판 말머리·갤러리 보기 전환 등 — 고른 쪽은 아래 진한 버튼색을 그대로 따라갑니다</small></div>
        <div className="cp-group">
          <CP label="배경" k="segBg" />
          <CP label="글씨" k="segFg" />
        </div>
      </div>

      <WidgetStyleRow />

      <div className="set-row">
        <div className="l"><b>진한 버튼</b><small>등록·저장 버튼과 체크박스·선택 필터 칩 공통</small></div>
        <div className="cp-group">
          <CP label="버튼" k="btnDark" />
          <CP label="글씨" k="btnDarkFg" />
          <CP label="호버" k="btnDarkHv" />
        </div>
      </div>

      <FontRoleRow role="title" />
      <FontRoleRow role="pagetitle" />
      <FontRoleRow role="subtitle" />
      <FontRoleRow role="logosub" />
      <FontRoleRow role="menu" />
      <FontRoleRow role="dropdown" />
      <FontRoleRow role="body" />

      <div className="set-row">
        <div className="l"><b>모서리 둥글기</b><small>카드/버튼 radius</small></div>
        <KStep value={state.vars.radius} min={0} max={30} onChange={v => setVar('radius', v)} />
      </div>

      <div className="set-row">
        <div className="l"><b>블록 그림자</b><small>패널·카드·배너·모달의 드롭섀도우 세기 — 0%는 그림자 없음</small></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
          <span className="cp-lb" style={{ marginLeft: 'auto' }}>색</span>
          <ColorField value={state.vars.shColor ?? '#000000'} onChange={hex => setVar('shColor', hex)} />
          <div className="mini-seg" style={{ marginLeft: 10 }}>
            {([['없음', 0], ['약하게', 30], ['보통', 50], ['강하게', 100]] as const).map(([label, v]) => (
              <button key={label} className={state.vars.shadow === v ? 'on' : ''}
                onClick={() => setVar('shadow', v)}>{label}</button>
            ))}
          </div>
          <KStep value={state.vars.shadow} min={0} max={200} step={10} suffix="%" onChange={v => setVar('shadow', v)} />
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>드롭다운 그림자</b><small>하위메뉴·프로필 메뉴·셀렉트 팝업·달력 — 블록 그림자와 별개, 없음도 가능</small></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="mini-seg">
            {([['없음', 0], ['약하게', 30], ['보통', 50], ['강하게', 100]] as const).map(([label, v]) => (
              <button key={label} className={(state.vars.ddShadow ?? 100) === v ? 'on' : ''}
                onClick={() => setVar('ddShadow', v)}>{label}</button>
            ))}
          </div>
          <KStep value={state.vars.ddShadow ?? 100} min={0} max={200} step={10} suffix="%" onChange={v => setVar('ddShadow', v)} />
        </div>
      </div>

      <SpellCheckRow />
    </div>
  );
}

function SpellCheckRow() {
  const { site, set } = useSiteDraft();
  const off = !!site.noSpell;
  return (
    <div className="set-row">
      <div className="l"><b>맞춤법 검사 밑줄</b><small>입력칸·에디터에 브라우저가 그리는 빨간 물결줄 — 끄면 사이트 전체에서 보이지 않습니다</small></div>
      <div className="mini-seg">
        <button className={!off ? 'on' : ''} onClick={() => set({ noSpell: false })}>표시</button>
        <button className={off ? 'on' : ''} onClick={() => set({ noSpell: true })}>숨김</button>
      </div>
    </div>
  );
}

function MainPagePane() {
  const { state, setMobileOff, setMobileOrder, resetMain } = useMainStore();
  const toast = useToast();
  const [resetAsk, setResetAsk] = useState(false);
  const orderable = state.mobileOrder
    .map(id => state.widgets.find(w => w.id === id))
    .filter((w): w is NonNullable<typeof w> => !!w && !w.fixed);

  return (
    <div className="set-sec">
      <div style={{ position: 'relative' }}>
        <h3>메인 페이지</h3>
        <button className="btn btn-ghost" style={{ position: 'absolute', right: 0, top: -3, padding: '6px 14px', fontSize: 11 }}
          onClick={() => setResetAsk(true)}>기본 구성</button>
      </div>
      <ConfirmModal open={resetAsk} title="메인 페이지를 기본 구성으로 되돌릴까요?"
        body="추가한 위젯과 배치·크기·모바일 순서가 전부 처음 상태로 돌아갑니다. 되돌린 뒤에는 복구할 수 없습니다."
        onClose={() => setResetAsk(false)}
        buttons={[
          { label: 'RESET', kind: 'accent', onClick: () => { resetMain(); setResetAsk(false); toast('메인 페이지가 기본 구성으로 돌아갔습니다'); } },
          { label: 'CANCEL', kind: 'ghost', onClick: () => setResetAsk(false) },
        ]} />
      <div className="d">모바일 표시 여부 + 모바일 세로 나열 순서 — ⠿ 드래그로 순서 변경</div>

      <DragList
        items={orderable}
        keyOf={w => w.id}
        onReorder={list => setMobileOrder(list.map(w => w.id))}
        render={(w, i) => (
          <div className="set-row" style={{ width: '100%' }}>
            <div className="l" style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
              <span className="mw-no">{i + 1}</span>
              <span className="drag-h">⠿</span>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <b>{widgetLabel(state.widgets, w)}</b>
                  {MULTI_TYPES.includes(w.type) && <span className="pill">중복 추가 가능</span>}
                </div>
                <small>{WIDGET_META[w.type].desc}</small>
              </div>
            </div>
            <KToggle checked={!w.mOff} onChange={v => setMobileOff(w.id, !v)} />
          </div>
        )}
      />
      <p className="hint">토글을 끄면 <b>모바일에서만</b> 빠지고 PC 메인에는 그대로 표시됩니다 · 순서는 <b>모바일 세로 나열 순서</b> — PC 배치는 메인에서 편집모드로 자유 조정</p>
      <p className="hint">메인에서 위젯을 완전히 빼거나 더하려면 편집모드에서 — 추가는 상단바 [＋ 위젯], 삭제는 위젯 우클릭 → 위젯 삭제</p>
      <p className="hint">고정 요소: 슬라이드 배너(최상단) · 회원정보창 — 순서 목록에 포함되지 않음</p>
    </div>
  );
}

function WidgetsPane() {
  const { state } = useMainStore();
  const editable = state.widgets.filter(w =>
    (['banner', 'memo', 'dday', 'todo', 'freetext', 'deco'] as const).some(t => t === w.type));

  const editorOf = (w: WidgetConf) => {
    switch (w.type) {
      case 'memo':
      case 'freetext': return <TextSettingEditor conf={w} />;
      case 'dday': return <DdayEditor conf={w} />;
      case 'todo': return <TodoEditor conf={w} />;
      case 'deco': return <DecoEditor conf={w} />;
      case 'banner': return <BannerEditor conf={w} />;
      default: return null;
    }
  };

  return (
    <div className="set-sec">
      <h3>위젯</h3>
      <div className="d">메인 위젯의 내용·설정값 관리 — 메인 페이지의 관리 모달과 같은 데이터라서 어느 쪽에서 바꿔도 즉시 반영</div>

      {editable.map(w => (
        <div key={w.id} style={{ padding: '16px 0', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
            <b style={{ fontSize: 13, letterSpacing: '.04em' }}>{widgetLabel(state.widgets, w)}</b>
            {MULTI_TYPES.includes(w.type) && <span className="pill">중복 추가 가능</span>}
            <small style={{ color: 'var(--faint)', fontSize: 10.5 }}>{WIDGET_META[w.type].desc}</small>
            {w.mOff && <span className="pill" style={{ marginLeft: 'auto' }}>모바일 제외</span>}
          </div>
          {editorOf(w)}
        </div>
      ))}
      <p className="hint">DIARY·LATEST·UPCOMING은 일기·로드뷰·스케줄 실데이터를 그대로 보여주는 위젯이라 별도 설정값이 없습니다 · 위젯 켜기/끄기와 순서는 「메인 페이지」 카테고리에서</p>
    </div>
  );
}

function BoardPane() {
  const {
    st, patchSystem, patchGallery,
    patchGalleryCat, addGalleryCat, removeGalleryCat, setGalleryCats,
  } = useBoardSettings();
  const { boards, setBoards, patchBoard } = useBoards();
  const [catBoard, setCatBoard] = useState(MAIN_BOARD_ID);
  const { list: secList } = useSections();
  const galSecs = secList('gallery');
  const [galSecSel, setGalSec] = useState(MAIN_SEC);
  const galSec = galSecs.some(s2 => s2.id === galSecSel) ? galSecSel : MAIN_SEC;
  const galCats = galleryCatsOf(st, galSec);
  const del = useConfirmDelete();

  const sel = boards.find(b => b.id === catBoard) ?? boards[0];
  const setCats = (cats: BoardBadge[]) => patchBoard(sel.id, { cats });
  const patchCat = (id: string, p: Partial<BoardBadge>) =>
    patchBoard(sel.id, { cats: sel.cats.map(c => (c.id === id ? { ...c, ...p } : c)) });

  const colorCells = (b: BoardBadge, patch: (p: Partial<BoardBadge>) => void) => (
    <>
      <span className="cp-lb">배경</span>
      <ColorField value={b.bg} onChange={hex => patch({ bg: hex })} />
      <span className="cp-lb">테두리</span>
      <ColorField value={b.border} onChange={hex => patch({ border: hex })} />
      <span className="cp-lb">글씨</span>
      <ColorField value={b.fg} onChange={hex => patch({ fg: hex })} />
    </>
  );

  return (
    <div className="set-sec">
      <h3>게시판 관리</h3>
      <div className="d">게시판 생성·삭제와 게시판별 스킨·권한·말머리 — 변경 즉시 메뉴·목록·글쓰기에 반영</div>

      <h3 style={{ marginTop: 20 }}>게시판 목록</h3>
      <div className="d">⠿ 드래그로 메뉴 순서 · 이름은 상단 메뉴와 페이지 타이틀에 그대로 표시 · 리스트 스킨(기본형/티켓형) 게시판마다 지정 — 글쓰기·댓글 권한은 메뉴 관리에서</div>
      <DragList items={boards} keyOf={b => b.id} onReorder={setBoards}
        render={b => (
          <div className="set-row" style={{ width: '100%' }}>
            <div className="l" style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
              <span className="drag-h">⠿</span>
              <KInput value={b.name} onChange={e => patchBoard(b.id, { name: e.target.value })}
                style={{ width: 110 }} />
              {b.id === MAIN_BOARD_ID && <span className="pill">기본</span>}
            </div>
            <div className="cp-group" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <div className="mini-seg">
                {(['list', 'ticket'] as BoardSkin[]).map(s => (
                  <button key={s} className={b.skin === s ? 'on' : ''}
                    onClick={() => patchBoard(b.id, { skin: s })}>{s === 'list' ? '기본형' : '티켓형'}</button>
                ))}
              </div>
              <span className="cp-lb">글씨</span>
              <ColorField value={b.fg ?? '#2c3037'} onChange={hex => patchBoard(b.id, { fg: hex })} />
              {b.fg && (
                <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }}
                  onClick={() => patchBoard(b.id, { fg: undefined })}>기본색</button>
              )}
              {b.id !== MAIN_BOARD_ID && (
                <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }}
                  onClick={() => del.ask(`게시판 「${b.name}」를 삭제하시겠습니까?`, () => {
                    setBoards(boards.filter(x => x.id !== b.id));
                    if (catBoard === b.id) setCatBoard(MAIN_BOARD_ID);
                  }, '메뉴에서 사라지지만 이 게시판에 쓴 글 데이터는 보존됩니다 (3장 원칙).')}>DELETE</button>
              )}
            </div>
          </div>
        )} />
      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }}
          onClick={() => setBoards([...boards, {
            id: newId(), name: '새 게시판', desc: '게시판 설명을 입력하세요',
            skin: 'list', permWrite: 'member', permComment: 'member', cats: DEFAULT_BOARD_CATS,
          }])}>＋ ADD BOARD</button>
      </div>

      <hr style={{ margin: '24px 0', border: 'none', borderTop: '1.5px solid var(--line)' }} />

      <h3>말머리</h3>
      <div className="d">게시판을 고른 뒤 ⠿ 드래그로 순서 · 이름 수정 · 추가/삭제 — 이름을 바꿔도 기존 글은 이전 이름으로 남습니다</div>
      {boards.length > 1 && (
        <div className="mini-seg" style={{ marginBottom: 12 }}>
          {boards.map(b => (
            <button key={b.id} className={sel.id === b.id ? 'on' : ''} onClick={() => setCatBoard(b.id)}>{b.name}</button>
          ))}
        </div>
      )}
      <DragList items={sel.cats} keyOf={c => c.id} onReorder={setCats}
        render={c => (
          <div className="set-row" style={{ width: '100%' }}>
            <div className="l" style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
              <span className="drag-h">⠿</span>
              <span style={boardBadgeStyle(c)}>{c.label || '말머리'}</span>
            </div>
            <div className="cp-group" style={{ justifyContent: 'flex-end' }}>
              <KInput value={c.label} onChange={e => patchCat(c.id, { label: e.target.value })}
                style={{ width: 90, textAlign: 'right' }} />
              {colorCells(c, p => patchCat(c.id, p))}
              <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }}
                onClick={() => del.ask(`말머리 「${c.label}」를 삭제하시겠습니까?`, () =>
                  patchBoard(sel.id, { cats: sel.cats.filter(x => x.id !== c.id) }),
                  '이 말머리로 쓴 기존 글은 유지되며 중립색 뱃지로 표시됩니다.')}>DELETE</button>
            </div>
          </div>
        )} />
      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }}
          onClick={() => setCats([...sel.cats, { id: newId(), label: '새 말머리', bg: '#eef0f2', border: '#d7dae0', fg: '#5d636d' }])}>＋ ADD</button>
      </div>

      <hr style={{ margin: '24px 0', border: 'none', borderTop: '1.5px solid var(--line)' }} />

      <h3>시스템 뱃지</h3>
      <div className="d">공지 · 비밀 · 접힘 — 색만 수정 (삭제 불가)</div>
      {st.system.map(b => (
        <div key={b.id} className="set-row">
          <div className="l"><span style={boardBadgeStyle(b)}>{b.label}</span></div>
          <div className="cp-group" style={{ justifyContent: 'flex-end' }}>
            {colorCells(b, p => patchSystem(b.id, p))}
          </div>
        </div>
      ))}

      <hr style={{ margin: '24px 0', border: 'none', borderTop: '1.5px solid var(--line)' }} />

      <h3>갤러리 유형 뱃지</h3>
      <div className="d">그림백업의 로그/단일 표시 — 라벨·색 수정 (삭제 불가)</div>
      {st.gallery.map(b => (
        <div key={b.id} className="set-row">
          <div className="l"><span style={boardBadgeStyle(b)}>{b.label || '유형'}</span></div>
          <div className="cp-group" style={{ justifyContent: 'flex-end' }}>
            <KInput value={b.label} onChange={e => patchGallery(b.id, { label: e.target.value })}
              style={{ width: 90, textAlign: 'right' }} />
            {colorCells(b, p => patchGallery(b.id, p))}
          </div>
        </div>
      ))}

      <h3 style={{ marginTop: 20 }}>갤러리 말머리</h3>
      <div className="d">
        그림백업 글쓰기에서 고르는 말머리 — ⠿ 드래그로 순서 · 추가·수정·삭제 자유
        {galSecs.length > 1 && <><br />갤러리마다 따로 정합니다 — <b>손대기 전까지는 기본 갤러리의 말머리를 그대로 씁니다</b></>}
      </div>
      {galSecs.length > 1 && (
        <div className="mini-seg" style={{ flexWrap: 'wrap', marginBottom: 10 }}>
          {galSecs.map(s2 => (
            <button key={s2.id} className={galSec === s2.id ? 'on' : ''} onClick={() => setGalSec(s2.id)}>{s2.name}</button>
          ))}
        </div>
      )}
      <DragList items={galCats} keyOf={c => c.id} onReorder={next => setGalleryCats(galSec, next)}
        render={c => (
          <div className="set-row" style={{ width: '100%' }}>
            <div className="l" style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
              <span className="drag-h">⠿</span>
              <span style={boardBadgeStyle(c)}>{c.label || '말머리'}</span>
            </div>
            <div className="cp-group" style={{ justifyContent: 'flex-end' }}>
              <KInput value={c.label} onChange={e => patchGalleryCat(galSec, c.id, { label: e.target.value })}
                style={{ width: 100, textAlign: 'right' }} />
              {colorCells(c, p => patchGalleryCat(galSec, c.id, p))}
              <span className="fx" data-tip="말머리 삭제"
                onClick={() => del.ask(`말머리 「${c.label}」를 삭제하시겠습니까?`,
                  () => removeGalleryCat(galSec, c.id),
                  '이미 이 말머리로 등록된 글은 그대로 남습니다.')}>✕</span>
            </div>
          </div>
        )} />
      <button className="btn btn-ghost" style={{ marginTop: 8, padding: '7px 14px', fontSize: 11 }}
        onClick={() => addGalleryCat(galSec)}>＋ 말머리 추가</button>

      <hr style={{ margin: '24px 0', border: 'none', borderTop: '1.5px solid var(--line)' }} />
      <SectionsBlock />

      {del.element}
    </div>
  );
}

function RelQPane() {
  const [sets, setSets] = useLocalList<RelQuestionSet>(RELQ_KEY, RELQ_SEED);
  const [selId, setSelId] = useState<string | null>(null);
  const del = useConfirmDelete();
  const relqToast = useToast();
  const txtRef = useRef<HTMLInputElement>(null);
  const sel = sets.find(s => s.id === selId) ?? sets[0];
  const patchSet = (id: string, p: Partial<RelQuestionSet>) =>
    setSets(sets.map(s => (s.id === id ? { ...s, ...p } : s)));

  const PER_Q = 12;
  const [qPage, setQPage] = useState(1);
  const qTotal = sel?.questions.length ?? 0;
  const qPages = Math.max(1, Math.ceil(qTotal / PER_Q));
  const qCur = Math.min(qPage, qPages);
  useEffect(() => { setQPage(1); }, [sel?.id]);
  const qStart = (qCur - 1) * PER_Q;
  const qShown = (sel?.questions ?? []).slice(qStart, qStart + PER_Q);
  return (
    <div className="set-sec">
      <h3>자관 질문</h3>
      <div className="d">질문 세트를 CP(커플)/NCP(커플 아님)로 구분해 관리 — 자관 상세에서 QUESTIONS 섹션을 추가할 때 세트를 골라 넣습니다</div>

      <h3 style={{ marginTop: 20 }}>질문 세트</h3>
      <div className="d">이름은 자유 수정 · CP/NCP 구분 · ⠿ 드래그로 순서</div>
      <DragList items={sets} keyOf={s => s.id} onReorder={setSets}
        render={s => (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', padding: '3px 0' }}>
            <span className="drag-h" style={{ fontSize: 11 }}>⠿</span>
            <KInput value={s.name} onChange={e => patchSet(s.id, { name: e.target.value })}
              style={{ width: 140, fontSize: 12, padding: '5px 10px' }} />
            <div className="mini-seg">
              {(['cp', 'ncp'] as const).map(t => (
                <button key={t} className={s.cat === t ? 'on' : ''}
                  onClick={() => patchSet(s.id, { cat: t })}>{CP_LABEL[t]}</button>
              ))}
            </div>
            <small style={{ marginLeft: 'auto', color: 'var(--faint)', fontSize: 10.5 }}>질문 {s.questions.length}개</small>
            <button className="btn btn-ghost" style={{ padding: '3px 9px', fontSize: 10.5 }}
              onClick={() => del.ask(`세트 「${s.name}」를 삭제하시겠습니까?`,
                () => setSets(sets.filter(x => x.id !== s.id)),
                '이미 자관에 넣은 질문들은 그대로 유지됩니다.')}>DELETE</button>
          </div>
        )} />
      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }}
          onClick={() => setSets([...sets, { id: newId(), name: '새 세트', cat: 'cp', questions: [] }])}>＋ ADD SET</button>
      </div>

      <hr style={{ margin: '24px 0', border: 'none', borderTop: '1.5px solid var(--line)' }} />

      <h3>질문 목록</h3>
      <div className="d">txt 파일은 줄바꿈을 기준으로 질문을 카운트합니다.</div>
      {sets.length > 1 && (
        <div className="mini-seg" style={{ marginBottom: 12 }}>
          {sets.map(s => (
            <button key={s.id} className={sel?.id === s.id ? 'on' : ''} onClick={() => setSelId(s.id)}>{s.name}</button>
          ))}
        </div>
      )}
      {sel && (
        <>
          <DragList items={qShown.map((q, i) => ({ q, key: `${sel.id}-${qStart + i}` }))} keyOf={x => x.key}
            onReorder={list => patchSet(sel.id, {
              questions: [
                ...sel.questions.slice(0, qStart),
                ...list.map(x => x.q),
                ...sel.questions.slice(qStart + PER_Q),
              ],
            })}
            render={({ q }, i) => {
              const gi = qStart + i;
              return (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', padding: '2px 0' }}>
                <span className="drag-h" style={{ fontSize: 11 }}>⠿</span>
                <small style={{ color: 'var(--faint)', fontSize: 10, minWidth: 26, textAlign: 'right' }}>{gi + 1}</small>
                <KInput value={q}
                  onChange={e => patchSet(sel.id, { questions: sel.questions.map((x, j) => (j === gi ? e.target.value : x)) })}
                  style={{ flex: 1, minWidth: 0, fontSize: 12, padding: '5px 10px' }} />
                <span className="fx" style={{ fontSize: 10, padding: '2px 4px' }}
                  onClick={() => {
                    const remove = () => patchSet(sel.id, { questions: sel.questions.filter((_, j) => j !== gi) });
                    if (q.trim()) del.ask(`질문을 삭제하시겠습니까?`, remove, `"${q.slice(0, 40)}${q.length > 40 ? '…' : ''}"`);
                    else remove();
                  }}>✕</span>
              </div>
              );
            }} />
          {qTotal > PER_Q && (
            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>
              <span />
              <Pager page={qCur} total={qPages} onChange={setQPage} />
              <small style={{ color: 'var(--faint)', fontSize: 10.5, justifySelf: 'end' }}>총 {qTotal}개</small>
            </div>
          )}
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <input ref={txtRef} type="file" accept=".txt,text/plain" style={{ display: 'none' }}
              onChange={async e => {
                const f = e.target.files?.[0]; e.target.value = '';
                if (!f) return;
                const lines = (await f.text()).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
                if (lines.length === 0) { relqToast('파일에서 질문을 찾지 못했습니다'); return; }
                patchSet(sel.id, { questions: [...sel.questions, ...lines] });
                relqToast(`질문 ${lines.length}개를 불러왔습니다`);
              }} />
            <button className="btn btn-dark" style={{ padding: '5px 12px', fontSize: 11 }}
              onClick={() => txtRef.current?.click()}>↑ TXT 업로드</button>
            <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }}
              onClick={() => {
                patchSet(sel.id, { questions: [...sel.questions, ''] });
                setQPage(Math.ceil((qTotal + 1) / PER_Q));
              }}>＋ ADD</button>
          </div>
        </>
      )}
      {del.element}
    </div>
  );
}

/** 회원/보안 탭 (관리자 권한 부여 기능 추가) */
function MemberPane() {
  const toast = useToast();
  const del = useConfirmDelete();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [codeLoaded, setCodeLoaded] = useState(false);
  const [regVer, setRegVer] = useState(0);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  useEffect(() => { setCode(inviteCode()); setCodeLoaded(true); }, []);
  void regVer;

  const members = useMembers();

  // 회원별 관리자 권한 상태 관리 (settingStore 연동)
  const [memberRoles, setMemberRoles] = useState<Record<string, string>>({});
  useEffect(() => {
    setMemberRoles(getSetting<Record<string, string>>('ohome.memberroles.v1', {}));
  }, []);

  const updateMemberRole = (userId: string, newRole: 'admin' | 'member') => {
    const updated = { ...memberRoles, [userId]: newRole };
    setMemberRoles(updated);
    setSetting('ohome.memberroles.v1', updated);
    toast(`회원 권한이 '${newRole === 'admin' ? '관리자' : '회원'}'으로 변경되었습니다.`);
    setRegVer(v => v + 1);
  };

  const serverOn2 = isServerMode();
  const authConsoleUrl = (() => {
    const c = serverConfig();
    if (c?.kind === 'firebase') return `https://console.firebase.google.com/project/${c.projectId}/authentication/users`;
    if (c?.kind === 'supabase') {
      const m = c.url.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co/i);
      return m ? `https://supabase.com/dashboard/project/${m[1]}/auth/users` : '';
    }
    return '';
  })();
  const [delMember, setDelMember] = useState<{ id: string; nickname: string } | null>(null);
  const registry = (() => {
    try { return JSON.parse(localStorage.getItem('ohome.mockreg.v1') ?? '{}') as Record<string, unknown>; } catch { return {}; }
  })();

  const PER_MEMBERS = 10;
  const [mq, setMq] = useState('');
  const [mPage, setMPage] = useState(1);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [mTags, setMTags] = useState<Record<string, string[]>>({});
  const [tagFor, setTagFor] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => { setMTags(getSetting<Record<string, string[]>>('ohome.membertags.v1', {})); }, []);
  const saveTags = (userId: string, tags: string[]) => {
    setMTags(prev => {
      const n = { ...prev };
      if (tags.length) n[userId] = tags; else delete n[userId];
      setSetting('ohome.membertags.v1', n);
      return n;
    });
  };
  const allTags = [...new Set(Object.values(mTags).flat())];

  // 관리자 판별 함수 (기본 admin 계정이거나 memberRoles에서 admin인 경우)
  const isAdminOf = (m: { id: string; role?: string }) => {
    if (m.id === 'admin' || m.role === 'admin') return true;
    return memberRoles[m.id] === 'admin';
  };

  const filteredMembers = members.filter(m => {
    if (removedIds.includes(m.id)) return false;
    const k = mq.trim().toLowerCase();
    const tags = mTags[m.id] ?? [];
    if (filterTag && !tags.includes(filterTag)) return false;
    return !k || m.nickname.toLowerCase().includes(k) || m.id.toLowerCase().includes(k)
      || tags.some(t => t.toLowerCase().includes(k));
  })
    .sort((a, b) => (isAdminOf(a) ? 0 : 1) - (isAdminOf(b) ? 0 : 1) || a.nickname.localeCompare(b.nickname));
  const pageMembers = filteredMembers.slice((mPage - 1) * PER_MEMBERS, mPage * PER_MEMBERS);

  return (
    <div className="set-sec">
      <h3>회원/보안</h3>
      <div className="d">가입코드와 회원 목록 관리 및 관리자 권한 부여</div>

      <div className="set-row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
        <div className="l"><b>가입코드</b><small>회원가입 시 입력해야 하는 초대코드 — 아는 사람에게만 공유</small></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <KInput value={code} onChange={e => setCode(e.target.value)} style={{ width: 220 }} />
          <button className="btn btn-dark" disabled={!codeLoaded}
            onClick={() => {
              if (!code.trim()) { toast('가입코드를 입력해 주세요'); return; }
              setInviteCode(code);
              toast('가입코드가 변경되었습니다');
            }}>SAVE</button>
        </div>
      </div>

      <h3 style={{ marginTop: 26 }}>회원 목록</h3>
      <div className="d">기본 계정(관리자)은 권한 변경이나 삭제를 할 수 없습니다 — 태그로 그룹화 및 관리자 권한 토글 가능</div>
      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l">
          {allTags.length > 0 ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {allTags.map(t => (
                <span key={t} className={`pill${filterTag === t ? ' dark' : ''}`} style={{ cursor: 'var(--cur-pointer,pointer)' }}
                  onClick={() => { setFilterTag(f => (f === t ? null : t)); setMPage(1); }}>{t}</span>
              ))}
            </div>
          ) : <b>태그 필터</b>}
        </div>
        <KInput placeholder="닉네임·아이디·태그 검색" value={mq}
          onChange={e => { setMq(e.target.value); setMPage(1); }}
          style={{ width: 200, fontSize: 12 }} />
      </div>
      {pageMembers.map(m => {
        const isBase = m.id === 'admin' || m.id === 'guest';
        const myTags = mTags[m.id] ?? [];
        const isCurrentAdmin = isAdminOf(m);

        return (
          <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
            <b style={{ fontSize: 12.5, cursor: 'var(--cur-pointer,pointer)' }} data-tip="회원 정보 보기"
              onClick={() => router.push(`/members/${m.id}`)}>{m.nickname}</b>
            <small style={{ color: 'var(--faint)', fontSize: 10.5 }} data-tip={m.id.length > 7 ? m.id : undefined}>
              {m.id.length > 7 ? `${m.id.slice(0, 7)}…` : m.id}
            </small>
            {myTags.map(t => (
              <span key={t} className="pill" style={{ cursor: 'var(--cur-pointer,pointer)' }} data-tip="태그 제거"
                onClick={() => del.ask(`태그 「${t}」를 제거하시겠습니까?`,
                  () => saveTags(m.id, myTags.filter(x => x !== t)),
                  `${m.nickname} 회원에게서만 제거됩니다.`)}>
                {t} <span style={{ fontSize: 8 }}>✕</span>
              </span>
            ))}
            {tagFor === m.id ? (
              <KInput autoFocus placeholder="태그" value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onBlur={() => setTagFor(null)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && tagInput.trim()) {
                    saveTags(m.id, [...new Set([...myTags, tagInput.trim()])]);
                    setTagInput(''); setTagFor(null);
                  }
                  if (e.key === 'Escape') setTagFor(null);
                }}
                style={{ width: 90, fontSize: 11, padding: '3px 8px' }} />
            ) : (
              <span className="fx" style={{ fontSize: 10 }} data-tip="태그 추가"
                onClick={() => { setTagFor(m.id); setTagInput(''); }}>＋</span>
            )}
            
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
              {!isBase && (
                <button className="btn btn-ghost" style={{ padding: '4px 11px', fontSize: 10.5, borderRadius: 20, lineHeight: 'normal' }}
                  onClick={() => {
                    const nextRole = isCurrentAdmin ? 'member' : 'admin';
                    updateMemberRole(m.id, nextRole);
                  }}>
                  {isCurrentAdmin ? '관리자 해제' : '관리자 지정'}
                </button>
              )}

              <span className="pill">{isCurrentAdmin ? '관리자' : '회원'}</span>

              {!isBase && !isCurrentAdmin && (
                <button className="btn btn-ghost" style={{ padding: '4px 11px', fontSize: 10.5, borderRadius: 20, lineHeight: 'normal', letterSpacing: '.04em' }}
                  onClick={() => {
                    if (serverOn2) { setDelMember({ id: m.id, nickname: m.nickname }); return; }
                    del.ask(`회원 「${m.nickname}」 계정을 삭제하시겠습니까?`, () => {
                      const reg = { ...registry };
                      delete reg[m.id];
                      try { localStorage.setItem('ohome.mockreg.v1', JSON.stringify(reg)); } catch { /* 무시 */ }
                      setRegVer(v => v + 1);
                      toast('계정이 삭제되었습니다');
                    }, '이 계정으로 다시 로그인할 수 없게 됩니다. 작성한 글은 그대로 남습니다.');
                  }}>DELETE</button>
              )}
            </div>
          </div>
        );
      })}
      {filteredMembers.length === 0 && (
        <p className="hint" style={{ margin: '10px 0 0' }}>조건에 맞는 회원이 없습니다</p>
      )}
      {filteredMembers.length > PER_MEMBERS && (
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
          <Pager page={mPage} total={Math.ceil(filteredMembers.length / PER_MEMBERS)} onChange={setMPage} />
        </div>
      )}
      <ConfirmModal open={delMember !== null} title={`회원 「${delMember?.nickname ?? ''}」 내보내기`}
        wide
        body={
          <div style={{ display: 'grid', gap: 10 }}>
            <p style={{ margin: 0 }}>
              <b>① 먼저 로그인 계정을 지웁니다.</b><br />
              계정 삭제는 관리자 권한이 필요한 작업이라 홈에서는 할 수 없습니다.
              아래 버튼으로 콘솔을 열어 <b>{delMember?.nickname}</b> 계정을 지워 주세요.
            </p>
            <p style={{ margin: 0 }}>
              <b>② 그다음 목록에서 지웁니다.</b><br />
              계정을 지우지 않고 목록에서만 지우면 <b>그 사람은 계속 로그인할 수 있습니다.</b>
            </p>
          </div>
        }
        onClose={() => setDelMember(null)}
        buttons={[
          ...(authConsoleUrl ? [{
            label: '① 콘솔에서 계정 지우기 ↗', kind: 'dark' as const,
            onClick: () => window.open(authConsoleUrl, '_blank', 'noopener'),
          }] : []),
          {
            label: '② 목록에서 지우기', kind: 'accent' as const,
            onClick: () => {
              const t = delMember;
              setDelMember(null);
              if (!t) return;
              void backend()?.deleteMember(t.id)
                .then(() => { setRemovedIds(v => [...v, t.id]); toast('회원 목록에서 지웠습니다'); })
                .catch(() => toast('지우지 못했습니다 — 관리자 계정으로 로그인했는지 확인해 주세요'));
            },
          },
          { label: 'CANCEL', kind: 'ghost' as const, onClick: () => setDelMember(null) },
        ]} />
      {del.element}
      {serverOn2 && <ConfigScopeWarnRow />}
      {serverOn2 && <ForkUpdateRow />}
      {serverOn2 && <SecurityRulesRow />}
    </div>
  );
}

function ConfigScopeWarnRow() {
  const src = serverConfigSource();
  const cfg = serverConfig();
  if (src !== 'local' || !cfg) return null;
  const download = () => {
    const blob = new Blob([configFileText(cfg)], { type: 'application/json' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u; a.download = 'ohome.config.json';
    a.click();
    URL.revokeObjectURL(u);
  };
  return (
    <div className="set-sec" style={{ marginTop: 26, border: '1.5px solid var(--accent)', borderRadius: 12, padding: 16 }}>
      <h3 style={{ color: 'var(--accent)' }}>방문자에게는 아직 설치 화면이 보입니다</h3>
      <div className="d" style={{ lineHeight: 1.7 }}>
        데이터베이스 연결이 <b>지금 이 브라우저에만</b> 저장돼 있습니다 — 다른 사람이 배포 주소로 들어오면
        홈이 아니라 「처음 여는 중」 설치 화면이 뜹니다. 아래 파일을 내려받아 <b>저장소의 public 폴더</b>에
        올리고 커밋하면 방문자도 같은 홈을 봅니다.
      </div>
      <div className="setup-row" style={{ marginTop: 10 }}>
        <button className="btn btn-dark" onClick={download}>ohome.config.json 내려받기</button>
      </div>
    </div>
  );
}

function ForkUpdateRow() {
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setUrl(getSetting<string>('ohome.repo.v1', '')); setLoaded(true); }, []);
  const trimmed = url.trim();
  const valid = /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/?$/i.test(trimmed);
  return (
    <div className="set-sec" style={{ marginTop: 26 }}>
      <h3>포크 업데이트</h3>
      <div className="d">
        내 포크 주소를 저장해 두면, 원본에 업데이트가 올라왔을 때 GitHub의 [Sync fork] 화면으로 바로 이동할 수 있습니다
      </div>
      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l"><b>내 포크 주소</b><small>GitHub에서 포크한 저장소의 주소</small></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <KInput placeholder="https://github.com/내아이디/O.home" value={url} onChange={e => setUrl(e.target.value)} style={{ width: 250 }} />
          <button className="btn btn-ghost" disabled={!loaded}
            onClick={() => { setSetting('ohome.repo.v1', trimmed); toast('저장되었습니다'); }}>SAVE</button>
          <button className="btn btn-dark" disabled={!valid}
            onClick={() => window.open(trimmed, '_blank', 'noopener')}>내 포크로 이동 ↗</button>
        </div>
      </div>
    </div>
  );
}

function SecurityRulesRow() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState('');
  const cfg = serverConfig();
  const copy = async (text: string, tag: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      setOpen(true);
    }
  };
  return (
    <div className="set-sec" style={{ marginTop: 26 }}>
      <h3>보안 규칙</h3>
      <div className="d">
        앱이 업데이트되며 규칙이 바뀔 때가 있습니다.
      </div>
      {cfg?.kind === 'firebase' ? (
        <div className="setup-row">
          <button className="btn btn-dark" onClick={() => copy(FIRESTORE_RULES, 'fs')}>
            {copied === 'fs' ? '복사됨 ✓' : 'Firestore 규칙 복사'}
          </button>
          <button className="btn btn-dark" onClick={() => copy(STORAGE_RULES, 'st')}>
            {copied === 'st' ? '복사됨 ✓' : 'Storage 규칙 복사'}
          </button>
          <button className="btn btn-ghost" onClick={() => setOpen(o => !o)}>{open ? '내용 접기' : '내용 보기'}</button>
        </div>
      ) : (
        <div className="setup-row">
          <button className="btn btn-dark" onClick={() => copy(SCHEMA_SQL, 'sql')}>
            {copied === 'sql' ? '복사됨 ✓' : '설치 SQL 복사'}
          </button>
          <button className="btn btn-ghost" onClick={() => setOpen(o => !o)}>{open ? '내용 접기' : '내용 보기'}</button>
        </div>
      )}
      {open && (cfg?.kind === 'firebase' ? (
        <>
          <pre className="setup-sql">{FIRESTORE_RULES}</pre>
          <pre className="setup-sql">{STORAGE_RULES}</pre>
        </>
      ) : (
        <pre className="setup-sql">{SCHEMA_SQL}</pre>
      ))}
    </div>
  );
}

function MoodPane() {
  const [moods, setMoods] = useLocalList<Mood>('ohome.moods.v1', MOOD_SEED);
  const [diaries] = useLocalList<DiaryPost>('ohome.diary.v1', DIARY_SEED);
  const del = useConfirmDelete();
  const patchMood = (id: string, p: Partial<Mood>) =>
    setMoods(moods.map(m => (m.id === id ? { ...m, ...p } : m)));
  return (
    <div className="set-sec">
      <h3>무드 리스트</h3>
      <div className="d">다이어리에서 고를 무드 — 이름 · 아이콘(이모지/특수문자) · 색 · ⠿ 드래그로 순서</div>

      <DragList items={moods} keyOf={m => m.id} onReorder={setMoods}
        render={m => (
          <div className="set-row" style={{ width: '100%' }}>
            <div className="l" style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
              <span className="drag-h">⠿</span>
              <span style={{
                width: 30, height: 30, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                background: moodTint(m.color), color: m.color, fontSize: 14,
              }}>{m.icon}</span>
            </div>
            <div className="cp-group" style={{ justifyContent: 'flex-end' }}>
              <SymbolInput value={m.icon} onChange={v => patchMood(m.id, { icon: v })}
                style={{ width: 46, textAlign: 'center' }} />
              <KInput value={m.name} onChange={e => patchMood(m.id, { name: e.target.value })}
                style={{ width: 110 }} />
              <ColorField value={m.color} onChange={hex => patchMood(m.id, { color: hex })} />
              <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10.5 }}
                onClick={() => {
                const used = diaries.filter(d => d.moodId === m.id).length;
                del.ask(`무드 「${m.name}」를 삭제하시겠습니까?`, () => setMoods(moods.filter(x => x.id !== m.id)),
                  used > 0 ? `이 무드로 쓴 일기 ${used}개는 유지되지만 아이콘이 기본 표시로 바뀝니다.` : undefined);
              }}>DELETE</button>
            </div>
          </div>
        )} />
      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }}
          onClick={() => setMoods([...moods, { id: newId(), name: '새 무드', icon: '✦', color: '#8a8f98' }])}>
          ＋ ADD MOOD
        </button>
      </div>
      {del.element}
    </div>
  );
}

function DocTitleControl() {
  const { site, set } = useSiteDraft();
  return (
    <LiveInput value={site.docTitle ?? ''} onValue={v => set({ docTitle: v })}
      placeholder={`${site.title} — 개인홈`}
      style={{ width: 260, height: 35, boxSizing: 'border-box' }} />
  );
}

function CrawlDescControl() {
  const { site, set } = useSiteDraft();
  return (
    <LiveInput value={site.crawlDesc ?? ''} onValue={v => set({ crawlDesc: v })}
      placeholder="자캐놀이용 개인 아카이브"
      style={{ width: 260, height: 35, boxSizing: 'border-box' }} />
  );
}

function FaviconControl() {
  const { site, set } = useSiteDraft();
  const toast = useToast();
  const url = useBlobUrl(site.favicon);
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{
        width: 35, height: 35, borderRadius: 'var(--radius-s)', border: '1px solid var(--line)',
        background: 'var(--panel)', display: 'grid', placeItems: 'center', overflow: 'hidden', flexShrink: 0,
      }}>
        {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          : <span style={{ fontSize: 10, color: 'var(--faint)' }}>기본</span>}
      </span>
      <input id="siteFavicon" type="file" accept="image/png,image/x-icon,image/svg+xml,image/webp,.ico"
        style={{ display: 'none' }}
        onChange={async e => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try { set({ favicon: await putBlob(f) }); } catch (err) {
            toast(`아이콘을 저장소에 올리지 못했습니다 — ${err instanceof Error ? err.message : String(err)}`);
          }
        }} />
      <button className="btn btn-ghost" style={{ height: 35, padding: '0 14px', fontSize: 11 }}
        onClick={() => document.getElementById('siteFavicon')?.click()}>
        {site.favicon ? 'CHANGE' : 'UPLOAD'}
      </button>
      {site.favicon && (
        <button className="btn btn-ghost" style={{ height: 35, padding: '0 14px', fontSize: 11 }}
          onClick={() => set({ favicon: undefined })}>REMOVE</button>
      )}
    </div>
  );
}

function LogoControls() {
  const { site, set } = useSiteDraft();
  return (
    <>
      <LiveInput value={site.title} onValue={v => set({ title: v })}
        style={{ width: 130, height: 35, boxSizing: 'border-box' }} />
      <LiveInput value={site.subtitle} onValue={v => set({ subtitle: v })}
        style={{ width: 160, height: 35, boxSizing: 'border-box' }} />
      <div className="mini-seg">
        {(['left', 'center', 'right'] as const).map(a => (
          <button key={a} className={site.align === a ? 'on' : ''} onClick={() => set({ align: a })}>
            {a === 'left' ? '왼쪽' : a === 'center' ? '가운데' : '오른쪽'}
          </button>
        ))}
      </div>
    </>
  );
}

async function fitCursorImage(f: File): Promise<{ blob: Blob; resized: boolean }> {
  if (/\.(cur|ani)$/i.test(f.name)) return { blob: f, resized: false };
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => {
      const i = new Image();
      i.onload = () => ok(i); i.onerror = no; i.src = url;
    });
    const max = Math.max(img.width, img.height);
    if (max <= 128) return { blob: f, resized: false };
    const k = 128 / max;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * k));
    c.height = Math.max(1, Math.round(img.height * k));
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>(ok => c.toBlob(ok, 'image/png'));
    return blob ? { blob, resized: true } : { blob: f, resized: false };
  } catch {
    return { blob: f, resized: false };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function CursorRow({ state }: { state: CursorState }) {
  const [st, patch] = useCursorSettings();
  const toast = useToast();
  const entry = st.states[state];
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!entry?.imgId) { setUrl(null); return; }
    let cancelled = false;
    let obj: string | null = null;
    getBlob(entry.imgId).then(async b => {
      if (!b || cancelled) return;
      const ani = parseAni(await b.arrayBuffer());
      if (cancelled) return;
      obj = URL.createObjectURL(ani ? ani.frames[0] : b);
      setUrl(obj);
    });
    return () => { cancelled = true; if (obj) URL.revokeObjectURL(obj); };
  }, [entry?.imgId]);
  const inputId = `curFile-${state}`;
  const setEntry = (p: Partial<{ imgId: string; hx: number; hy: number }>) =>
    patch({ states: { ...st.states, [state]: { imgId: entry?.imgId ?? '', hx: 0, hy: 0, ...entry, ...p } } });
  return (
    <div className="set-row" style={{ flexWrap: 'wrap' }}>
      <div className="l" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{
          width: 36, height: 36, borderRadius: 9, border: '1.5px dashed var(--line)',
          display: 'grid', placeItems: 'center', overflow: 'hidden', flexShrink: 0,
        }}>
          {url ? <img src={url} alt="" style={{ maxWidth: 32, maxHeight: 32 }} /> : <span style={{ color: 'var(--faint)', fontSize: 14 }}>✛</span>}
        </span>
        <div><b>{CURSOR_STATE_LABEL[state].label}</b><small>{CURSOR_STATE_LABEL[state].desc}</small></div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input id={inputId} type="file" accept="image/png,image/gif,image/webp,image/x-icon,.cur,.ani" style={{ display: 'none' }}
          onChange={async e => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            const { blob, resized } = await fitCursorImage(f);
            setEntry({ imgId: await putBlob(blob) });
            if (resized) toast('커서로 쓸 수 있게 128px 이내로 줄였습니다');
          }} />
        <button className="btn btn-ghost" style={{ height: 33, padding: '0 12px', fontSize: 11 }}
          onClick={() => document.getElementById(inputId)?.click()}>{entry ? 'CHANGE' : 'UPLOAD'}</button>
        {entry && (
          <>
            <span className="cp-lb">핫스팟 X</span>
            <KStep value={entry.hx} min={0} max={32
