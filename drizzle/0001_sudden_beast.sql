CREATE TABLE `a1_telemetry_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`printerId` varchar(16) NOT NULL,
	`serial` varchar(32),
	`observedAt` bigint NOT NULL,
	`state` varchar(16) NOT NULL,
	`progress` int,
	`remainingSeconds` int,
	`nozzleTemperature` int,
	`bedTemperature` int,
	`fanSpeed` int,
	`wifiSignal` int,
	`layerNumber` int,
	`totalLayers` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `a1_telemetry_history_id` PRIMARY KEY(`id`)
);
