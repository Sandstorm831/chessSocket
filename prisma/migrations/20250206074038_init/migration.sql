-- CreateTable
CREATE TABLE `Game` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `RoomID` VARCHAR(191) NOT NULL,
    `white` VARCHAR(191) NOT NULL,
    `black` VARCHAR(191) NOT NULL,
    `PGN` VARCHAR(191) NOT NULL,
    `result` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Game_RoomID_key`(`RoomID`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
