using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Top11.Web.Database.Entities
{
	public class Account
	{
		public int Id { get; set; }
		public required string GoogleId { get; set; }
		public required string Email { get; set; }
		public DateTime CreatedAt { get; set; }
		public DateTime LastActivity { get; set; }
		public required List<Team> Teams { get; set; }
	}

	internal class AccountConfiguration : IEntityTypeConfiguration<Account>
	{
		public void Configure(EntityTypeBuilder<Account> builder)
		{
			builder.HasKey(e => e.Id);

			builder.Property(e => e.Id)
				.ValueGeneratedOnAdd();

			builder.Property(e => e.GoogleId)
				.IsRequired();

			builder.Property(e => e.Email)
				.IsRequired();

			builder.Property(e => e.CreatedAt)
				  .HasDefaultValueSql("GETDATE()")
				  .ValueGeneratedOnAdd();

			builder.Property(e => e.CreatedAt)
				  .HasDefaultValueSql("GETDATE()")
				  .ValueGeneratedOnAdd();
		}
	}
}
