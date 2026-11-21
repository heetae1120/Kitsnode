'use client';

import {useEffect, useRef} from 'react';

export type PolicyDocument = {title: string; url: string};

/** Displays the original document rather than a potentially stale copy. */
export function AdPolicyDialog({document, onClose}: {document: PolicyDocument | null; onClose: () => void}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (document && !dialog.open) dialog.showModal();
    if (!document && dialog.open) dialog.close();
  }, [document]);

  return <>
    <style>{`
      .ad-policy-dialog { width: min(760px, calc(100% - 32px)); max-width: none; max-height: min(800px, calc(100dvh - 32px)); padding: 0; border: 1px solid #dedede; border-radius: 18px; background: #fff; color: #202020; box-shadow: 0 24px 80px rgba(0,0,0,.25); }
      .ad-policy-dialog::backdrop { background: rgba(20,20,20,.66); }
      .ad-policy-dialog__header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px 24px; border-bottom: 1px solid #e9e9e9; }
      .ad-policy-dialog__header h2 { margin: 0; font-size: 18px; line-height: 1.4; }
      .ad-policy-dialog__close { flex: none; border: 1px solid #d9d9d9; border-radius: 8px; padding: 8px 12px; color: #333; background: #fff; cursor: pointer; }
      .ad-policy-dialog__frame { display: block; width: 100%; height: min(60vh, 540px); border: 0; background: #fff; }
      .ad-policy-dialog__footer { margin: 0; padding: 14px 24px 18px; border-top: 1px solid #e9e9e9; color: #555; font-size: 13px; }
      .ad-policy-dialog__footer a { color: #a23c1b; text-decoration: underline; }
      @media (max-width: 520px) { .ad-policy-dialog__header { padding: 16px; } .ad-policy-dialog__header h2 { font-size: 16px; } .ad-policy-dialog__footer { padding: 12px 16px 16px; } }
    `}</style>
    <dialog ref={dialogRef} className="ad-policy-dialog" aria-labelledby="ad-policy-title" onClose={onClose}>
      {document && <>
        <div className="ad-policy-dialog__header"><h2 id="ad-policy-title">{document.title}</h2><button type="button" className="ad-policy-dialog__close" onClick={() => dialogRef.current?.close()} autoFocus>닫기</button></div>
        <iframe className="ad-policy-dialog__frame" title={document.title} src={document.url} referrerPolicy="no-referrer" />
        <p className="ad-policy-dialog__footer">내용이 표시되지 않나요? <a href={document.url} target="_blank" rel="noopener noreferrer">원문 열기 (새 창)</a></p>
      </>}
    </dialog>
  </>;
}
