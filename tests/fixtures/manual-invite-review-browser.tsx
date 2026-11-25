import React from 'react';
import {createRoot} from 'react-dom/client';
import {ManualInviteReview} from '../../src/components/store/manual-invite-review';

createRoot(document.getElementById('root')!).render(<ManualInviteReview userId="test-user"/>);
