/* BAZOO shared interface: browser-native select popups replaced with branded, accessible listboxes.
   The original <select> stays in each form so existing JavaScript, validation and Supabase saves work. */
(function () {
  "use strict";
  const instances = new WeakMap();
  let opened = null, sequence = 0, scheduled = false;
  const esc = (value) => String(value == null ? "" : value);
  const clean = (value) => esc(value).replace(/\s+/g, " ").trim();
  const icon = () => {
    const node = document.createElement("span");
    node.className = "bz-select-caret";
    node.setAttribute("aria-hidden", "true");
    return node;
  };
  function labelFor(select) {
    const explicit = select.getAttribute("aria-label");
    if (explicit) return clean(explicit);
    const el = select.closest("label");
    if (el) {
      const text = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(" ");
      if (clean(text)) return clean(text);
    }
    return "اختر من القائمة";
  }
  function sync(select) {
    const ui = instances.get(select);
    if (!ui) return;
    const selected = select.options[select.selectedIndex];
    ui.value.textContent = selected ? clean(selected.textContent) : "اختر من القائمة";
    if (ui.trigger.disabled !== select.disabled) ui.trigger.disabled = select.disabled;
    ui.wrap.classList.toggle("bz-is-disabled", select.disabled);
    ui.wrap.classList.toggle("bz-is-placeholder", !select.value);
    if (opened?.select === select) {
      opened.items.forEach(item => {
        const selectedItem = Number(item.dataset.index) === select.selectedIndex;
        item.classList.toggle("bz-is-selected", selectedItem);
        item.setAttribute("aria-selected", String(selectedItem));
      });
    }
  }
  function enhance(select) {
    if (instances.has(select) || select.closest("[data-bazoo-native]")) return;
    if (!select.parentNode || select.multiple || select.size > 1) return;
    const wrap = document.createElement("span");
    wrap.className = "bz-select";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "bz-select-trigger";
    trigger.setAttribute("role", "combobox");
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", labelFor(select));
    const value = document.createElement("span");
    value.className = "bz-select-value";
    trigger.append(value, icon());
    const parent = select.parentNode;
    parent.insertBefore(wrap, select);
    wrap.append(select, trigger);
    select.classList.add("bz-native-select");
    select.setAttribute("aria-hidden", "true");
    select.tabIndex = -1;
    const ui = { select, wrap, trigger, value };
    instances.set(select, ui);
    trigger.addEventListener("click", () => {
      if (select.disabled) return;
      if (opened?.select === select) close();
      else open(ui, false);
    });
    trigger.addEventListener("keydown", (event) => {
      if (select.disabled) return;
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        if (opened?.select !== select) open(ui, true);
        else focusOption(opened, event.key === "ArrowUp" ? -1 : 1);
      }
    });
    select.addEventListener("change", () => sync(select));
    select.form?.addEventListener("reset", () => window.requestAnimationFrame(() => sync(select)));
    sync(select);
  }
  function close(returnFocus) {
    if (!opened) return;
    const prior = opened;
    opened = null;
    prior.trigger.setAttribute("aria-expanded", "false");
    prior.wrap.classList.remove("bz-is-open");
    prior.panel.remove();
    if (returnFocus && prior.trigger.isConnected && !prior.trigger.disabled) prior.trigger.focus();
  }
  function place() {
    if (!opened) return;
    const { trigger, panel } = opened;
    if (!trigger.isConnected) { close(); return; }
    const rect = trigger.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.min(viewportWidth - 20, Math.max(220, rect.width));
    const left = Math.max(10, Math.min(viewportWidth - width - 10, rect.right - width));
    const maxHeight = Math.max(155, Math.min(365, Math.round(viewportHeight * .53)));
    panel.style.width = width + "px";
    panel.style.left = left + "px";
    panel.style.maxHeight = maxHeight + "px";
    const height = Math.min(maxHeight, panel.scrollHeight);
    const roomBelow = viewportHeight - rect.bottom;
    const roomAbove = rect.top;
    const above = roomBelow < height + 10 && roomAbove > roomBelow;
    panel.style.top = Math.max(8, Math.min(viewportHeight - height - 8,
      above ? rect.top - height - 6 : rect.bottom + 6)) + "px";
    panel.classList.toggle("bz-select-above", above);
  }
  function selectIndex(index) {
    if (!opened) return;
    const { select } = opened;
    const item = select.options[index];
    if (!item || item.disabled || select.disabled) return;
    const changed = select.selectedIndex !== index;
    select.selectedIndex = index;
    sync(select);
    close();
    if (changed) select.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function focusOption(session, step) {
    if (!session || opened !== session) return;
    const available = session.items.filter(item => !item.disabled && !item.hidden);
    if (!available.length) return;
    const index = available.indexOf(document.activeElement);
    const next = (index + step + available.length) % available.length;
    available[next].focus();
  }
  function open(ui, fromKeyboard) {
    close();
    if (ui.select.disabled) return;
    const select = ui.select, panel = document.createElement("div");
    panel.className = "bz-select-popover";
    panel.dir = "rtl";
    panel.id = "bazoo-listbox-" + (++sequence);
    panel.setAttribute("role", "listbox");
    panel.setAttribute("aria-label", ui.trigger.getAttribute("aria-label") || "الخيارات");
    panel.tabIndex = -1;
    ui.trigger.setAttribute("aria-controls", panel.id);
    ui.trigger.setAttribute("aria-expanded", "true");
    ui.wrap.classList.add("bz-is-open");
    const options = Array.from(select.options);
    let search = null;
    if (options.length >= 9) {
      const heading = document.createElement("div");
      heading.className = "bz-select-search";
      search = document.createElement("input");
      search.type = "search";
      search.placeholder = "ابحث في الخيارات...";
      search.setAttribute("aria-label", "بحث في الخيارات");
      search.autocomplete = "off";
      heading.appendChild(search);
      panel.appendChild(heading);
    }
    const body = document.createElement("div");
    body.className = "bz-select-list";
    const items = options.map((option, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "bz-select-option";
      button.setAttribute("role", "option");
      button.dataset.index = String(index);
      button.textContent = clean(option.textContent);
      button.disabled = option.disabled;
      const active = select.selectedIndex === index;
      button.classList.toggle("bz-is-selected", active);
      button.setAttribute("aria-selected", String(active));
      button.addEventListener("click", () => selectIndex(index));
      body.appendChild(button);
      return button;
    });
    panel.appendChild(body);
    document.body.appendChild(panel);
    const session = { panel, trigger: ui.trigger, wrap: ui.wrap, select, items };
    opened = session;
    if (search) {
      search.addEventListener("input", () => {
        const query = clean(search.value).toLocaleLowerCase("ar");
        let visible = 0;
        items.forEach((item) => {
          item.hidden = !clean(item.textContent).toLocaleLowerCase("ar").includes(query);
          if (!item.hidden) visible++;
        });
        empty.hidden = visible !== 0;
        place();
      });
      const empty = document.createElement("div");
      empty.className = "bz-select-empty";
      empty.textContent = "لا توجد نتائج مطابقة";
      empty.hidden = true;
      body.appendChild(empty);
      search.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown") { e.preventDefault(); focusOption(session, 1); }
        if (e.key === "Enter") {
          const first = items.find(item => !item.hidden && !item.disabled);
          if (first) { e.preventDefault(); selectIndex(Number(first.dataset.index)); }
        }
      });
    }
    panel.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); close(true); return; }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault(); focusOption(session, e.key === "ArrowDown" ? 1 : -1);
      } else if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        const enabled = items.filter(item => !item.hidden && !item.disabled);
        const candidate = e.key === "Home" ? enabled[0] : enabled[enabled.length - 1];
        candidate?.focus();
      } else if (e.key === "Enter" || e.key === " ") {
        if (document.activeElement?.classList.contains("bz-select-option")) {
          e.preventDefault(); selectIndex(Number(document.activeElement.dataset.index));
        }
      }
    });
    place();
    if (search) search.focus();
    else if (fromKeyboard) {
      const selected = items.find(item => Number(item.dataset.index) === select.selectedIndex && !item.disabled);
      (selected || items.find(item => !item.disabled))?.focus();
    }
  }
  function scan() {
    scheduled = false;
    document.querySelectorAll("select:not(.bz-native-select)").forEach(enhance);
    document.querySelectorAll("select.bz-native-select").forEach(sync);
    if (opened && !opened.select.isConnected) close();
  }
  function scheduleScan() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(scan);
  }
  document.addEventListener("pointerdown", (event) => {
    if (opened && !opened.panel.contains(event.target) && !opened.trigger.contains(event.target)) close();
  }, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && opened) { event.preventDefault(); event.stopImmediatePropagation(); close(true); }
  }, true);
  document.addEventListener("change", (event) => {
    if (event.target?.matches?.("select")) sync(event.target);
  }, true);
  window.addEventListener("resize", place, { passive: true });
  window.addEventListener("scroll", place, { capture: true, passive: true });
  function initialize() {
    scan();
    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
  window.BAZOO_UI = { refresh: scheduleScan, closeSelect: close };
})();
