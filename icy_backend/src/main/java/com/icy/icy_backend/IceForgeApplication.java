package com.icy.icy_backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class IceForgeApplication {
	public static void main(String[] args) {
		SpringApplication.run(IceForgeApplication.class, args);
	}
}
