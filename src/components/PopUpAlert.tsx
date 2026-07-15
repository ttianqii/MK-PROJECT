import Swal, { SweetAlertIcon } from "sweetalert2";

let timerInterval: ReturnType<typeof setInterval> | undefined;

export default function PopUpAlert(title: string, html: string, icon: SweetAlertIcon) {
  Swal.fire({
    title,
    html,
    timer: 2500,
    timerProgressBar: true,
    icon,
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
