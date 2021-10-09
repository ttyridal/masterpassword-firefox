(()=>{
"use strict";

const template = document.createElement('template');
template.innerHTML = `
<style>
:root {
}
:host([hidden]) { display: none }
.combobox-list {
  font: inherit;
  position: relative;
  color: inherit;
  list-style-image: none;
  list-style-position:none;
  list-style-type:none;
  list-style:none;
  text-align:left;
  width: inherit;
  height: inherit;
  background: inherit;
  color: inherit;
  vertical-align: inherit;
  padding: .2em 0;

}
input {
box-sizing: border-box;
  font-size: var(--cb-input-font, inherit);
  width: inherit;
  vertical-align: middle;
  height: inherit;
  color: inherit;
  margin: 0;
  padding: var(--cb-padding, 0);
  background: var(--cb-background);
  border: var(--cb-border, 10px solid green);
}
input:focus {
  border: var(--cb-focus-border; inherit);
  outline: var(--cb-focus-outline);
  outline-offset: var(--cb-focus-outline-offset);
}
ul[role="listbox"] {
  margin: 0;
  padding: 0;
  padding-left: 0.3em;
  position: absolute;
  left: 0;
  top: calc(var(--cb-input-font) + 1.75em);
  list-style: none;
  background:  var(--cb-background, inherit);
  display: none;
  box-sizing: border-box;
  max-height: 12em;
  width: inherit;
  overflow: scroll;
  overflow-x: hidden;
  font-size: 87.5%;
  z-index:100;
}

ul[role="listbox"] li[role="option"] {
  font-size: var(--cb-drop-font, inherit);
  border-top: 1px solid transparent;
  border-bottom: 1px solid transparent;
  display: block;
  margin: 0;
  padding: 0.1em 0.3em;
}
[role="listbox"] li[role="option"]:hover {
    color: #000;
    background-color: var(--text-color);
    
}
[role="listbox"].open {
    display: block;
}
[role="listbox"].focus [role="option"][aria-selected="true"] {
  background-color: #DEF;
  border-color: #8CCBF2;
}
</style>
<div class="combobox combobox-list">
     <input id="cb1-input"
           class="cb_edit"
           type="text"
           role="combobox"
           aria-autocomplete="list"
           aria-expanded="false"
           aria-controls="cb1-listbox">
     <ul id="cb1-listbox" tabindex="-1"
      role="listbox"
      aria-label="">
     </ul>
</div>
`

class ListBox {
    constructor(domNode) {
        this.domNode = domNode;
        this.allOptions = [];

        this._focus = false;
    }

    isOpen() {
        return this.domNode.classList.contains('open');
    }

    open(doOpen) {
        if (doOpen)
            this.domNode.classList.add('open');
        else {
            this.domNode.classList.remove('open');
            this._focus = false;
        }
    }

    find(v) {
        for (let li of this.allOptions) {
            if (li.textContent == v) return li;
        }
        return null;
    }

    focus() {
        this._focus=true;
        this.domNode.classList.add('focus');
    }

    hasFocus() {
        return this._focus;
    }

    hasOptions() {
        return this.domNode.childElementCount > 0;
    }

    countOptions() {
        return this.domNode.querySelectorAll('li:not(.sep)').length;
    }

    getNextItem(cur) {
        let r = cur.nextElementSibling;
        if (!r) return this.getFirstItem();
        if (r.classList.contains('sep')) return this.getNextItem(r);
        return r;
    }
    getPreviousItem(cur) {
        let r = cur.previousElementSibling;
        if (!r) return this.getLastItem();
        if (r.classList.contains('sep')) return this.getPreviousItem(r);
        return r;
    }

    getFirstItem() {
        return this.domNode.firstElementChild;
    }
    getLastItem() {
        return this.domNode.lastElementChild;
    }

    setSelected(opt) {
        for (let li of this.allOptions) {
            if (li == opt) {
                this.domNode.scrollTop = opt.offsetTop;
                li.setAttribute('aria-selected', 'true');
            }
            else
                li.removeAttribute('aria-selected');
        }
    }

    filterOptions(filter) {
        filter = filter.toLowerCase();
        this.domNode.innerHTML = '';
        let cnt = 0;
        for (let li of this.allOptions) {
            if (li.classList.contains('sep') && cnt)
                this.domNode.appendChild(li);
            
            if ((filter != '') && !(li.innerText.toLowerCase().includes(filter)))
                continue;
            cnt++;
            this.domNode.appendChild(li);
        }
    }
}


class ComboBox extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.handleKeydown = this.handleKeydown.bind(this);
        this.handleKeyup = this.handleKeyup.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.handleFocus = this.handleFocus.bind(this);
        this.handleBlur = this.handleBlur.bind(this);
        this.handleSlotchange = this.handleSlotchange.bind(this);
        this.domNode = null;
        this.option = null;
        this.filter = '';
        this._value = '';

    }
    connectedCallback() {
        this.shadowRoot.appendChild(template.content.cloneNode(true));
        this.domNode  = this.shadowRoot.querySelector('.combobox');
        this.inputNode = this.shadowRoot.querySelector('[role="combobox"]');
        this.inputNode.value = this._value;
        this.inputNode.placeholder = this.placeholder || '';
        this.listbox = new ListBox(this.shadowRoot.querySelector('[role="listbox"]'));
        
        this.domNode.addEventListener('keydown', this.handleKeydown);
        this.domNode.addEventListener('keyup',   this.handleKeyup);
        this.domNode.addEventListener('click',   this.handleClick);
        this.inputNode.addEventListener('focus',   this.handleFocus);
        this.inputNode.addEventListener('blur',    this.handleBlur);
    }
    disconnectedCallback() {
        this.domNode.removeEventListener('keydown', this.handleKeydown);
        this.domNode.removeEventListener('keyup',   this.handleKeyup);
        this.domNode.removeEventListener('click',   this.handleClick);
        this.inputNode.removeEventListener('focus',   this.handleFocus);
        this.inputNode.removeEventListener('blur',    this.handleBlur);
    }


    static observedAttributes = ["value", "placeholder"];

    attributeChangedCallback(name, oldvalue, newvalue) {
        console.log("attrchange", name, newvalue);
        if (name=='value' && newvalue != this._value)
            this.value = newvalue;
        else if (name=='placeholder') {
            if (this.inputNode)this.inputNode.setAttribute("placeholder", newvalue);
            this.placeholder = newvalue;
        }
    }

    insertOption(pos, txt, opts) {
        let li;
        if (txt instanceof HTMLElement) {
            let idx = this.listbox.allOptions.indexOf(txt);
            if (idx == -1)
                throw "only elements previously returned are allowed";
            [li] = this.listbox.allOptions.splice(idx,1);
        } else {
            if (!(typeof txt == 'string')) {
                throw "must be string or list element";
            }
            li = document.createElement('li');
            li.setAttribute('role', "option");
            li.innerText = txt;
        }
        this.listbox.allOptions.splice(pos, 0, li);
    }

    addOption(txt, opts) {
        let li = document.createElement('li');
        if (opts && opts.separator) {
            li.innerHTML = '<hr>';
            li.classList.add('sep');
        } else {
            li.setAttribute('role', "option");
            li.innerText = txt;
        }
        if (opts && opts.selected) {
            this.option = li;
            this.inputNode.value = txt;
        }

        this.listbox.allOptions.push(li);
    }

    clearOptions() {
        this.listbox.allOptions.length=0;
    }

    setValue(v) {
        if (v == this.original_value) return;
        this.original_value = v;  // so handleBlur doesn't fool us
        const event = new Event('change', {
            bubbles: true,
            cancelable: false,
        });
        this.value = v;
        this.dispatchEvent(event);
    }

    set value(v) {
        if (this.inputNode) this.inputNode.value = v;
        this._value = v;
        this.setAttribute('value', v);
    }

    get value() {
        return this._value;
    }

    open() {
        console.log("calling open");
//         this.inputNode.focus();
        this.listbox.filterOptions('');
        this.listbox.open(true);
    }


    handleSlotchange(ev) { }

    handleClick(event) {
        if ((event.target.tagName == 'LI') && event.target.getAttribute('role') == 'option') {
            this.option = event.target;
            this.listbox.open(false);
            this.setValue(this.option.textContent);
        } else {
            this.listbox.open(!this.listbox.isOpen());
        }
    }

    handleFocus() {
        this.original_value = this.inputNode.value;
        this.filter = '';
        this.listbox.filterOptions(this.filter);
        this.inputNode.select();
    }

    handleBlur() {
        this.inputNode.value = this.original_value;
        setTimeout(this.listbox.open.bind(this.listbox, false), 300);
    }

    setOption(opt) {
        this.option = opt;
        this.inputNode.value = opt.textContent;
        this.listbox.setSelected(opt);
    }

    handleKeydown(event) {
        switch (event.code) {
            case 'ArrowDown':
                if (this.listbox.hasOptions()) {
                    if (this.listbox.hasFocus() && this.option)
                        this.setOption(this.listbox.getNextItem(this.option));
                    else {
                        this.listbox.open(true);
                        this.listbox.focus();
                        this.setOption(this.listbox.getFirstItem());
                    }
                    event.preventDefault();
                    event.stopPropagation();
                }
                break;
            case 'ArrowUp':
                if (this.listbox.hasOptions()) {
                    if (this.listbox.hasFocus() && this.option)
                        this.setOption(this.listbox.getPreviousItem(this.option));
                    else {
                        this.listbox.open(true);
                        this.listbox.focus();
                        this.setOption(this.listbox.getLastItem());
                    }
                    event.preventDefault();
                    event.stopPropagation();
                }
                break;
            case 'Escape':
                this.inputNode.value = this.original_value;
                this.listbox.open(false);
                this.inputNode.blur();
                break;
            case 'Enter':
                this.option = this.option || this.listbox.find(this.inputNode.value);
                this.setValue(this.inputNode.value);
                this.inputNode.blur();
                break;
            case 'Tab':
                this.option = this.option || this.listbox.find(this.inputNode.value);
                this.setValue(this.inputNode.value);
                break;
            case 'Home':
            case 'End':
            case 'ArrowLeft':
            case 'ArrowRight':
            default:
            break;
        }
    
    }

    handleKeyup(event) {
        const isPrintableCharacter = (str) => { return str.length === 1 && str.match(/\S/); }
        const key = event.key;
        
        if (isPrintableCharacter(key)) {
            this.filter += key;
            this.option = null;
            this.listbox.open(true);
        }

        switch (event.code) {
            case 'Enter':
            case 'Escape':
            case 'ArrowUp':
            case 'ArrowDown':
                return;
            default:
        }


        // this is for the case when a selection in the textbox has been deleted
        if ((this.inputNode.value.length < this.filter.length) || (['Delete', 'Backspace'].includes(event.code))) {
            this.filter = this.inputNode.value;
            this.listbox.open(true);
            this.option = null;
            this.listbox.filterOptions(this.filter);
            return;
        }
        this.listbox.filterOptions(this.filter);


        if (this.listbox.countOptions() == 1) {
            let soleOption = this.listbox.getFirstItem();
            if (soleOption.textContent.startsWith(this.filter)) {
                this.setOption(soleOption);
                this.inputNode.setSelectionRange(this.filter.length, 999);
                
            }
        }
    }
}

customElements.define('mp-combobox', ComboBox);
})();

