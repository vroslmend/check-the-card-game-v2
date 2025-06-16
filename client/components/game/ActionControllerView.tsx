'use client';

import React from 'react';
import ActionBarComponent from './ActionBarComponent';
import { useActionController } from './ActionController';

/**
 * This component is responsible for rendering the UI of the action bar.
 * It uses the context provided by ActionController to get the available actions
 * and the relevant prompt text.
 */
export const ActionControllerView = () => {
    const { getActions, getPromptText } = useActionController();

    return (
        <ActionBarComponent actions={getActions()}>
            {getPromptText() && (
                <p className="text-sm font-medium text-stone-800 dark:text-stone-200 drop-shadow-sm">
                    {getPromptText()}
                </p>
            )}
        </ActionBarComponent>
    );
};