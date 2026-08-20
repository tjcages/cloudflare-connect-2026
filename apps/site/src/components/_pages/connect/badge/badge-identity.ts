export type BadgeCardIdentity = {
  name: string;
  company: string;
  role: string;
  serial: string;
  accent: string;
};

export function badgeIdentityLayout(
  width: number,
  height: number,
  footerBand: number
) {
  const s = width / 1024;
  const footer = Math.round(height * footerBand);
  const top = height - footer;
  const pad = width * 0.08;
  const nameSize = Math.round(116 * s);
  const companySize = Math.round(72 * s);
  const roleSize = Math.round(36 * s);
  const nameY = top + 28 * s;
  const companyY = nameY + nameSize + 16 * s;
  const roleBoxPadX = 18 * s;
  const roleBoxPadY = 14 * s;
  const roleBoxY = companyY + companySize + 28 * s;
  const roleBoxH = roleBoxPadY * 2 + roleSize;
  return {
    s,
    pad,
    nameSize,
    companySize,
    roleSize,
    nameY,
    companyY,
    roleY: roleBoxY + roleBoxPadY,
    roleBoxY,
    roleBoxH,
    roleBoxPadX,
    roleBoxPadY,
  };
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function drawIdentity(
  ctx: CanvasRenderingContext2D,
  identity: BadgeCardIdentity,
  width: number,
  height: number,
  footerBand: number
) {
  const footer = Math.round(height * footerBand);
  const top = height - footer;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, top, width, footer);

  const layout = badgeIdentityLayout(width, height, footerBand);
  const maxText = width - layout.pad * 2;
  ctx.textBaseline = "top";

  ctx.fillStyle = "#1a1a1a";
  ctx.font = `400 ${layout.nameSize}px "STK Bureau Sans", sans-serif`;
  ctx.fillText(identity.name, layout.pad, layout.nameY, maxText);

  ctx.fillStyle = "#5c5c5c";
  ctx.font = `600 ${layout.companySize}px "STK Bureau Sans", sans-serif`;
  ctx.fillText(identity.company, layout.pad, layout.companyY, maxText);

  const roleLine = `${identity.role.toUpperCase()} · ${identity.serial}`;
  ctx.font = `600 ${layout.roleSize}px "Paper Mono", ui-monospace, monospace`;
  const roleWidth = Math.min(
    ctx.measureText(roleLine).width,
    maxText - layout.roleBoxPadX * 2
  );
  const boxW = roleWidth + layout.roleBoxPadX * 2;
  const radius = 8 * layout.s;
  ctx.strokeStyle = identity.accent;
  ctx.lineWidth = Math.max(1, 1.5 * layout.s);
  roundRectPath(
    ctx,
    layout.pad,
    layout.roleBoxY,
    boxW,
    layout.roleBoxH,
    radius
  );
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = identity.accent;
  ctx.fill();
  ctx.restore();
  roundRectPath(
    ctx,
    layout.pad,
    layout.roleBoxY,
    boxW,
    layout.roleBoxH,
    radius
  );
  ctx.stroke();

  ctx.fillStyle = identity.accent;
  ctx.fillText(
    roleLine,
    layout.pad + layout.roleBoxPadX,
    layout.roleY,
    roleWidth
  );
}
