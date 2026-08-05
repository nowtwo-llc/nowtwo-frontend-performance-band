import { beforeEach, describe, expect, it } from 'vitest';
import {
    clear,
    el,
    hiddenLabel,
    hostMarkup,
    preserveFocus,
    uniqueId,
    VISUALLY_HIDDEN_CLASS
} from '../../src/dom/element';

describe('el', () => {
    beforeEach(() => {
        document.body.replaceChildren();
    });

    it('creates an element with attributes and children', () => {
        const node = el('div', { class: 'a', 'data-x': 'y' }, ['text', el('span')]);

        expect(node.className).to.equal('a');
        expect(node.getAttribute('data-x')).to.equal('y');
        expect(node.textContent).to.equal('text');
        expect(node.querySelector('span')).to.not.equal(null);
    });

    it('drops false, null and undefined attributes rather than stringifying them', () => {
        const node = el('input', { disabled: false, checked: null, name: undefined, type: 'text' });

        expect(node.hasAttribute('disabled')).to.equal(false);
        expect(node.hasAttribute('checked')).to.equal(false);
        expect(node.hasAttribute('name')).to.equal(false);
        expect(node.getAttribute('type')).to.equal('text');
    });

    it('renders a true attribute as an empty string, which is how HTML spells it', () => {
        expect(el('input', { checked: true }).getAttribute('checked')).to.equal('');
    });

    it('skips null and undefined children', () => {
        expect(el('div', {}, [null, undefined, 'kept']).textContent).to.equal('kept');
    });
});

describe('hostMarkup', () => {
    it('parses a string, because host icon markup is trusted by contract', () => {
        expect(hostMarkup('<i class="icon"></i>').querySelector('i')).to.not.equal(null);
    });

    it('uses a Node as-is, so a host can opt out of HTML parsing entirely', () => {
        const node = hostMarkup(document.createTextNode('<not-markup>'));

        expect(node.textContent).to.equal('<not-markup>');
        expect(node.querySelector('not-markup')).to.equal(null);
    });

    it('clones the Node, so one cached icon can be used in many places', () => {
        const icon = el('i', { class: 'shared' });
        const first = hostMarkup(icon);
        const second = hostMarkup(icon);

        expect(first.firstChild).to.not.equal(second.firstChild);
        expect(first.querySelector('.shared')).to.not.equal(null);
        expect(second.querySelector('.shared')).to.not.equal(null);
    });

    it('applies an optional class name', () => {
        expect(hostMarkup('x', 'wrapper').className).to.equal('wrapper');
    });
});

describe('clear', () => {
    it('removes every child', () => {
        const node = el('div', {}, ['a', el('span')]);
        clear(node);

        expect(node.childNodes).to.have.length(0);
    });
});

describe('uniqueId', () => {
    it('never repeats, because two editors can share a page', () => {
        expect(uniqueId('x')).to.not.equal(uniqueId('x'));
    });

    it('keeps the prefix', () => {
        expect(uniqueId('nt-band')).to.contain('nt-band-');
    });
});

describe('hiddenLabel', () => {
    it('is a real label bound to the control and hidden only visually', () => {
        const label = hiddenLabel('field-1', 'Band label');

        expect(label.tagName).to.equal('LABEL');
        expect(label.getAttribute('for')).to.equal('field-1');
        expect(label.className).to.equal(VISUALLY_HIDDEN_CLASS);
        expect(label.textContent).to.equal('Band label');
    });
});

describe('preserveFocus', () => {
    beforeEach(() => {
        document.body.replaceChildren();
    });

    it('restores focus and the selection after a move detaches the field', () => {
        const container = el('div');
        const input = el('input', { type: 'text', value: 'hello' });
        const other = el('div');
        container.append(input, other);
        document.body.append(container);

        input.focus();
        input.setSelectionRange(2, 4);

        preserveFocus(() => container.append(input));

        expect(document.activeElement).to.equal(input);
        expect(input.selectionStart).to.equal(2);
        expect(input.selectionEnd).to.equal(4);
    });

    it('does nothing when the focused element is not a text field', () => {
        const button = el('button');
        document.body.append(button);
        button.focus();

        preserveFocus(() => {});

        expect(document.activeElement).to.equal(button);
    });

    it('does not refocus a field the mutation removed from the document', () => {
        const input = el('input', { type: 'text' });
        document.body.append(input);
        input.focus();

        preserveFocus(() => input.remove());

        expect(document.activeElement).to.not.equal(input);
    });
});
