'use client';

import { useId, useRef } from 'react';
import { signOut } from '@/app/login/actions';
import { usePopoverPosition } from '@/lib/hooks/usePopoverPosition';
import styles from './planner.module.css';

type Props = {
  email: string;
};

/** Same native-popover pattern as ExportMenu/CardActions. */
export function AccountMenu({ email }: Props) {
  const id = useId().replace(/:/g, '');
  const menuId = `account-${id}`;
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  usePopoverPosition(triggerRef, ref, { width: 216 });

  const initials = email.slice(0, 2).toUpperCase();

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={styles.avatar}
        popoverTarget={menuId}
        aria-label={`Account: ${email}`}
      >
        <span aria-hidden="true">{initials}</span>
      </button>

      <div id={menuId} popover="auto" ref={ref} className={styles.menu}>
        <p className={styles.menuIdentity}>{email}</p>
        <hr className={styles.menuRule} />
        <form action={signOut}>
          <button type="submit" className={`${styles.menuItem} ${styles.menuDanger}`}>
            Sign out
          </button>
        </form>
      </div>
    </>
  );
}
