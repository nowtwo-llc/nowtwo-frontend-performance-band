import type { HostBridge } from '../types';
import { el, hostMarkup } from './element';

/**
 * The column header. It is a table purely so it inherits the host's `dataList`
 * styling and lines up with the rows underneath, which are flex.
 */
export function buildHeader(): HTMLElement {
    const columns = el('colgroup', {}, [
        el('col', { style: 'width: 110px' }),
        el('col'),
        el('col', { style: 'width: 120px' }),
        el('col', { style: 'width: 130px' }),
        el('col', { style: 'width: 90px' }),
        el('col', { style: 'width: 50px' })
    ]);

    const headings = el('tr', { class: 'dataList-row dataList-row--header dataList-row--noHover' }, [
        el('th', { class: 'dataList-cell' }, ['Colour']),
        el('th', { class: 'dataList-cell' }, ['Band']),
        el('th', { class: 'dataList-cell' }, ['Minimum']),
        el('th', { class: 'dataList-cell' }, ['Covers']),
        el('th', { class: 'dataList-cell' }, ['Mastery']),
        el('th', { class: 'dataList-cell' }, [''])
    ]);

    return el('div', { class: 'dataList' }, [
        el('div', { class: 'dataList-table' }, [
            el('table', { class: 'dataList-table' }, [columns, el('tbody', {}, [headings])])
        ])
    ]);
}

export function buildEmptyState(): HTMLElement {
    // role="status" so the transition to and from empty is announced; it is the
    // only feedback that deleting the last band did anything.
    return el('div', { class: 'band-container--empty', role: 'status' }, [
        'There are no performance bands. In order to proceed please add one.',
        el('br'),
        'Use the "Add a Band" button below to add your first one.'
    ]);
}

export interface Footer {
    element: HTMLElement;
    setSummary(count: number, mastery: number): void;
}

export function buildFooter(host: HostBridge, onAdd: () => void): Footer {
    const summary = el('span');
    const addButton = el('button', { type: 'button', class: 'button button--link' }, [
        el('span', { class: 'button-text' }, [hostMarkup(host.icon('regular', 'fa-plus')), ' Add a Band'])
    ]);
    addButton.addEventListener('click', onAdd);

    // The summary is the one number that changes as a result of edits made
    // elsewhere on the page, so it is the one thing worth announcing. Polite,
    // because it updates on every mastery toggle.
    const element = el('div', { class: 'band-footer-container' }, [
        el('div', { class: 'float--right', role: 'status', 'aria-live': 'polite' }, [summary]),
        addButton
    ]);

    return {
        element,
        setSummary(count: number, mastery: number): void {
            summary.textContent = `${count} ${count === 1 ? 'band' : 'bands'} · ${mastery} counting as mastery`;
        }
    };
}
