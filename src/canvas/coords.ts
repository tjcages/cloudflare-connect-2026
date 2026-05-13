export const getCanvasPoint = (
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  logicalWidth: number,
  logicalHeight: number,
) => {
  const bounds = canvas.getBoundingClientRect();
  const scaleX = logicalWidth / bounds.width;
  const scaleY = logicalHeight / bounds.height;

  return {
    x: (clientX - bounds.left) * scaleX,
    y: (clientY - bounds.top) * scaleY,
  };
};

export const isPointerOverCanvas = (canvas: HTMLCanvasElement, clientX: number, clientY: number): boolean => {
  const bounds = canvas.getBoundingClientRect();
  return clientX >= bounds.left && clientX < bounds.right && clientY >= bounds.top && clientY < bounds.bottom;
};
