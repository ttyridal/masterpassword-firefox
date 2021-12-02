/* Copyright Torbjorn Tyridal 2021

    This file is part of Masterpassword for Firefox (herby known as "the software").

    The software is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    The software is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with the software.  If not, see <http://www.gnu.org/licenses/>.
*/
(()=>{
"use strict";

const template = document.createElement('template');
template.innerHTML = `
<link href="../css/font-awesome.min.css" rel="stylesheet"/>
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
  background: var(--main-bg-color);
  padding: .2em 0;

}
.horz_flex {
  display:flex;
  width: inherit;
  align-items: center;
  justify-content: center;
}
button {
  margin-left:.5em;
  margin-right: -0.5em;
  color: #969eac;
  background-color: var(--header-bg-color);
  background-image: linear-gradient(lighten(#383e48, 2%), var(--header-bg-color));
  min-width: 1.8em;
  min-height: 1.8em;
  border: 1px solid #181a1f;
  display: inline-block;
  padding: 3px 8px;
  text-align: center;
  white-space: nowrap;
  vertical-align: middle;
  cursor: pointer;
}

input {
box-sizing: border-box;
  font-size: var(--cb-input-font, inherit);
  width: inherit;
  flex-grow: 1;
  vertical-align: middle;
  height: var(--cb-input-height);
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
  top: calc(var(--cb-input-font) + 1em);
  list-style: none;
  background:  var(--cb-background, inherit);
  display: none;
  box-sizing: border-box;
  min-height: 8em;
  max-height: 12em;
  width: inherit;
  overflow: scroll;
  overflow-x: hidden;
  font-size: 87.5%;
  z-index:100;
}

.unhider {
    display:block;
    width:100%;
    color:gray;
    display: flex;
    font-size: 0.7em;
    flex-direction: row;
}
.unhider:before, .unhider:after{
  content: "";
  flex: 1 1;
  border-bottom: 1px solid;
  margin: auto;
}
.unhider:before {
  margin-right: 5px
}
.unhider:after {
  margin-left: 5px
}


ul[role="listbox"] li[role="option"] {
  font-size: var(--cb-drop-font, inherit);
  border-top: 1px solid transparent;
  border-bottom: 1px solid transparent;
  display: block;
  margin: 0;
  padding: 0.1em 0.3em;
}
ul[role="listbox"] li[role="option"].hidden {display:none;}

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
   <div class="horz_flex">
     <input id="cb1-input"
           class="cb_edit"
           type="text"
           role="combobox"
           aria-autocomplete="list"
           aria-expanded="false"
           aria-controls="cb1-listbox">
     <button id="cb1-btn" style="display:none"><i class="fa fa-chevron-down fa-2" aria-hidden="true"></i></button>
   </div>
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
        return this.domNode.querySelectorAll('li:not(.sep),li:not(.unhide)').length;
    }

    getNextItem(cur) {
        let r = cur.nextElementSibling;
        if (!r) return this.getFirstItem();
        if (r.classList.contains('unhide')) {
            return this.getFirstItem();
        }
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
        let l = this.domNode.lastElementChild;

        while(l && (l.classList.contains('hidden') || l.classList.contains('unhide')))
            l=l.previousElementSibling;

        return l;
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

    unhideOptions() {
        let l = this.domNode.querySelector('.unhide');
        l.innerHTML = '<hr>';
        l.classList.replace('unhide', 'sep');
        Array.prototype.map.call(this.domNode.querySelectorAll('.hidden'), e=>e.classList.remove('hidden'));
    }
}


class ComboBox extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.handleInput = this.handleInput.bind(this);
        this.handleKeydown = this.handleKeydown.bind(this);
        this.handleKeyup = this.handleKeyup.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.handleMouseDown = this.handleMouseDown.bind(this);
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
        this.fitText(this.inputNode);
        this.inputNode.placeholder = this.placeholder || '';
        this.listbox = new ListBox(this.shadowRoot.querySelector('[role="listbox"]'));

        this.domNode.addEventListener('input', this.handleInput);
        this.domNode.addEventListener('keydown', this.handleKeydown);
        this.domNode.addEventListener('keyup',   this.handleKeyup);
        this.domNode.addEventListener('click',   this.handleClick);
        this.domNode.addEventListener('mousedown',   this.handleMouseDown);
        this.inputNode.addEventListener('focus',   this.handleFocus);
        this.inputNode.addEventListener('blur',    this.handleBlur);
    }
    disconnectedCallback() {
        this.domNode.removeEventListener('keydown', this.handleKeydown);
        this.domNode.removeEventListener('keyup',   this.handleKeyup);
        this.domNode.removeEventListener('click',   this.handleClick);
        this.domNode.removeEventListener('mousedown',   this.handleMouseDown);
        this.inputNode.removeEventListener('focus',   this.handleFocus);
        this.inputNode.removeEventListener('blur',    this.handleBlur);
    }


    static observedAttributes = ["value", "placeholder"];

    attributeChangedCallback(name, oldvalue, newvalue) {
        if (name=='value' && newvalue != this._value)
            this.value = newvalue;
        else if (name=='placeholder') {
            if (this.inputNode)this.inputNode.setAttribute("placeholder", newvalue);
            this.placeholder = newvalue;
        }
    }

    insertOption(pos, txt) {
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
            li.innerHTML = '<span class="unhider">show unrelated too</span>';
            li.classList.add('unhide');
//             li.innerHTML = '<hr>';
//             li.classList.add('sep');
            this.separator_inserted = true;
        } else {
            li.setAttribute('role', "option");
            if (this.separator_inserted)
                li.classList.add('hidden');
            li.innerText = txt;
        }
        if (opts && opts.selected) {
            this.option = li;
            this.inputNode.value = txt;
            this.fitText(this.inputNode);
        }

        this.listbox.allOptions.push(li);
        if (this.listbox.allOptions.length == 2)
            this.domNode.querySelector('#cb1-btn').style.display='';
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
        if (this.inputNode) {
            this.inputNode.value = v;
            this.fitText(this.inputNode);
        }
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


    handleSlotchange() { }

    handleMouseDown(event) {
        if (event.target == this.inputNode) return;
        if (event.target.tagName == 'I' || event.target.tagName == 'BUTTON') {
            this.listbox.open(!this.listbox.isOpen());
            this.inputNode.focus();
        }

        // for all others.. prevent input node from loosing focus
        event.preventDefault();
    }

    handleClick(event) {
        if (event.target.tagName == 'SPAN') {
            this.listbox.unhideOptions();
        }
        else if ((event.target.tagName == 'LI') && event.target.getAttribute('role') == 'option') {
            this.option = event.target;
            this.listbox.open(false);
            this.setValue(this.option.textContent);
        } else {
            //this.listbox.open(!this.listbox.isOpen());
        }
    }

    handleFocus() {
        this.original_value = this.inputNode.value;
        this.filter = '';
        this.listbox.filterOptions(this.filter);
        this.inputNode.select();
    }

    handleBlur() {
        if (this.inputNode.value != this.original_value)
            this.setValue(this.inputNode.value);
        setTimeout(this.listbox.open.bind(this.listbox, false), 300);
    }

    setOption(opt) {
        this.option = opt;
        this.inputNode.value = opt.textContent;
        this.fitText(this.inputNode);
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
            case 'Escape':  // doesn't work on firefox https://bugzilla.mozilla.org/show_bug.cgi?id=1443758
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
        if ((this.inputNode.value.length < this.filter.length) || (['Delete', 'Backspace'].includes(event.code))) {
            this.filter = this.inputNode.value;
            this.listbox.open(true);
            this.option = null;
            this.listbox.filterOptions(this.filter);
            return;
        }
        this.listbox.filterOptions(this.filter);


        // preselect the first "most probable" option
        let soleOption = this.listbox.getFirstItem();
        if (this.filter.length >= 1 && soleOption) {
            if (soleOption.textContent.startsWith(this.filter)) {
                this.setOption(soleOption);
                this.inputNode.setSelectionRange(this.filter.length, 999);
            }
        }
    }

    handleInput() {
        this.fitText(this.inputNode);
    }

    fitText(el) {
        const minSize = 12;
        el.removeAttribute('style');
        const fontWeight = getCssStyle(el, 'font-weight') || 'normal';
        let fontSize = parseFloat(getCssStyle(el, 'font-size') || '16px');
        if (!this._original_font_size) this._original_font_size = fontSize;

        const fontFamily = getCssStyle(el, 'font-family') || 'Times New Roman';
        const width = el.clientWidth;
        const height = el.clientHeight;
        if (!width || !height) return;
        let txtwidth;
        try { // not supported on firefox mobile. so just ignore..
            txtwidth = getTextWidth(el.value, `${fontWeight} ${fontSize}px ${fontFamily}`);
        } catch (err) {return;}

        while(txtwidth < width && fontSize < this._original_font_size) {
            fontSize += 0.3;
            txtwidth = getTextWidth(el.value, `${fontWeight} ${fontSize}px ${fontFamily}`);
        }
        while(txtwidth > width && fontSize > minSize) {
            fontSize -= 0.3;
            txtwidth = getTextWidth(el.value, `${fontWeight} ${fontSize}px ${fontFamily}`);
        }
        el.style.fontSize = fontSize + 'px';
    }
}

function getTextWidth(text, font) {
  // re-use canvas object for better performance
  const canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement("canvas"));
  const context = canvas.getContext("2d");
  context.font = font;
  const metrics = context.measureText(text);
  return metrics.width;
}

function getCssStyle(element, prop) {
    return window.getComputedStyle(element, null).getPropertyValue(prop);
}


customElements.define('mp-combobox', ComboBox);
})();

