const memoryDialog = document.querySelector(".memory-dialog");

if (memoryDialog instanceof HTMLDialogElement) {
    const gallery = memoryDialog.querySelector(".memory-dialog-gallery");
    const title = memoryDialog.querySelector("#memory-dialog-title");
    const description = memoryDialog.querySelector(".memory-dialog-description");
    const closeButton = memoryDialog.querySelector(".memory-dialog-close");

    if (
        gallery instanceof HTMLElement &&
        title instanceof HTMLElement &&
        description instanceof HTMLElement &&
        closeButton instanceof HTMLButtonElement
    ) {
        document.querySelectorAll(".memory-card").forEach((card) => {
            if (!(card instanceof HTMLButtonElement)) {
                return;
            }

            card.addEventListener("click", () => {
                gallery.replaceChildren();
                const imagePaths = (card.dataset.images ?? "")
                    .split("|")
                    .map((path) => path.trim())
                    .filter(Boolean);

                imagePaths.forEach((path) => {
                    const image = document.createElement("img");
                    image.className = "memory-dialog-image";
                    image.src = path;
                    image.alt = card.dataset.title ?? "Ảnh khoảnh khắc";
                    gallery.append(image);
                });

                title.textContent = card.dataset.title ?? "";
                description.textContent = card.dataset.description ?? "";
                memoryDialog.showModal();
            });
        });

        closeButton.addEventListener("click", () => memoryDialog.close());

        memoryDialog.addEventListener("click", (event) => {
            if (event.target === memoryDialog) {
                memoryDialog.close();
            }
        });
    }
}
