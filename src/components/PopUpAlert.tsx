import Swal, { SweetAlertIcon } from "sweetalert2";

let timerInterval: ReturnType<typeof setInterval> | undefined;

interface PopUpAlertOptions {
  /** Recolor a built-in icon (success/error/…). Ignored when imageUrl is set. */
  iconColor?: string;
  /**
   * Show a custom image (e.g. an animated gif) instead of the built-in
   * icon. Opt-in only — a large gif plus this component's short auto-dismiss
   * timer means a slow connection can close the popup before the image even
   * loads, so this must never be a blanket default for every alert.
   */
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
}

export default function PopUpAlert(
  title: string,
  html: string,
  icon: SweetAlertIcon,
  options: PopUpAlertOptions = {}
) {
  const { iconColor, imageUrl, imageWidth = 96, imageHeight = 96 } = options;
  Swal.fire({
    title,
    html,
    timer: 2500,
    timerProgressBar: true,
    icon: imageUrl ? undefined : icon,
    iconColor,
    imageUrl,
    imageWidth,
    imageHeight,
    imageAlt: title,
    showConfirmButton: false,
    didOpen: () => {
      const b = Swal.getHtmlContainer()?.querySelector("b");
      if (b) {
        timerInterval = setInterval(() => {
          const timerLeft = Swal.getTimerLeft();
          if (timerLeft !== null && b) {
            b.textContent = timerLeft?.toString() as string;
          }
        }, 100);
      }
    },
    willClose: () => {
      clearInterval(timerInterval);
    },
  });
}
