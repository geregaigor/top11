using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Top11.Db.Entities
{
	public class Account
	{
		public Account()
		{
			Id = Guid.NewGuid();
		}

		public Guid Id { get; set; }
		public required string GoogleId { get; set; }
		public required string Email { get; set; }
	}

	internal class AccountConfiguration : IEntityTypeConfiguration<Account>
	{
		public void Configure(EntityTypeBuilder<Account> builder)
		{
			builder.HasKey(e => e.Id);

			builder.Property(e => e.GoogleId)
				.IsRequired();

			builder.Property(e => e.Email)
				.IsRequired();
		}
	}
}
