(() => {
  'use strict';
  const status = document.querySelector('#release-status');
  const message = document.querySelector('#release-message');
  const feedback = document.querySelector('#download-feedback');
  const signing = document.querySelector('#signing-note');
  const allowedIds = new Set(['dmg', 'zip']);
  const positiveBytes = value => Number.isSafeInteger(value) && value > 0;
  const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
  function safeDownload(item, release) {
    if (release.status !== 'published' || release.installerType !== 'automatic-download-helper' || !positiveBytes(release.payloadBytes) || !positiveBytes(release.requiredFreeBytes) || release.requiredFreeBytes < release.payloadBytes || item.verified !== true || !allowedIds.has(item.id) || !validHash(item.sha256) || !Number.isSafeInteger(item.bytes) || item.bytes <= 0) return null;
    try {
      const url = new URL(item.url);
      if (url.protocol !== 'https:' || url.username || url.password || !Array.isArray(release.allowedDownloadHosts) || !release.allowedDownloadHosts.includes(url.hostname)) return null;
      if (!item.filename || /[\\/\r\n]/.test(item.filename)) return null;
      return url.href;
    } catch { return null; }
  }
  function formatBytes(bytes) {
    const [unit, divisor] = bytes >= 1e9 ? ['GB', 1e9] : bytes >= 1e6 ? ['MB', 1e6] : ['KB', 1e3];
    return `${(bytes / divisor).toLocaleString('ko-KR', {maximumFractionDigits: 2})}${unit}`;
  }
  function payloadLabel(release) {
    if (positiveBytes(release.payloadBytes)) return formatBytes(release.payloadBytes);
    return positiveBytes(release.payloadEstimateBytes) ? `약 ${formatBytes(release.payloadEstimateBytes)}` : '추가';
  }
  async function copyHash(hash) {
    try { await navigator.clipboard.writeText(hash); feedback.textContent = '파일 확인용 SHA-256 값을 복사했습니다.'; }
    catch { feedback.textContent = `파일 확인용 SHA-256: ${hash}`; }
  }
  async function loadRelease() {
    try {
      const response = await fetch('./release.json', {cache: 'no-store', credentials: 'omit'});
      if (!response.ok) throw new Error('release unavailable');
      const release = await response.json();
      if (release.schemaVersion !== 1 || !Array.isArray(release.packages)) throw new Error('invalid release');
      if (release.installerType !== 'automatic-download-helper') throw new Error('unsupported installer type');
      document.querySelectorAll('[data-payload-note]').forEach(note => { note.textContent = `도우미를 받은 뒤 ${payloadLabel(release)}의 설치 자료를 자동으로 받습니다.`; });
      if (positiveBytes(release.requiredFreeBytes)) document.querySelector('#required-space').textContent = `최초 설치 약 ${formatBytes(release.requiredFreeBytes)}`;
      if (typeof release.signing?.label === 'string') signing.textContent = release.signing.label;
      let ready = 0;
      for (const item of release.packages) {
        const href = safeDownload(item, release);
        if (!href) continue;
        const row = document.querySelector(`[data-package="${item.id}"]`);
        if (!row) continue;
        const actions = row.querySelector('[data-package-actions]');
        const link = document.createElement('a');
        link.className = 'download-button';
        link.href = href; link.rel = 'noopener';
        link.textContent = `설치 도우미 ${item.id.toUpperCase()} 받기`;
        link.setAttribute('aria-label', `VERA-X 설치 도우미 ${item.id.toUpperCase()} 다운로드`);
        const icon = row.querySelector('svg').cloneNode(true);
        link.append(icon);
        const hash = document.createElement('button');
        hash.type = 'button'; hash.className = 'checksum-button'; hash.textContent = '파일 확인값 복사';
        hash.addEventListener('click', () => copyHash(item.sha256));
        const note = row.querySelector('[data-payload-note]');
        actions.replaceChildren(link, hash, ...(note ? [note] : []));
        const meta = row.querySelector('[data-package-meta]');
        meta.textContent = `도우미 ${formatBytes(item.bytes)} · ${item.filename}`; meta.hidden = false;
        ready++;
      }
      if (ready) {
        status.textContent = '다운로드 제공 중';
        document.querySelector('.release-state').classList.add('is-published');
        document.querySelector('#release-version').textContent = /^[0-9]+\.[0-9]+(?:\.[0-9]+)?$/.test(release.version) ? release.version : '';
        message.textContent = '설치 도우미를 열면 필요한 자료를 자동으로 준비합니다.';
        if (release.signing?.label) signing.textContent = release.signing.label;
      }
    } catch {
      status.textContent = '배포 정보 확인 필요';
      message.textContent = '배포 정보를 불러오지 못했습니다. 잠시 후 페이지를 새로고침해 주세요.';
    }
  }
  loadRelease();
})();
